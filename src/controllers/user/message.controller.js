import mongoose from "mongoose";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { notifyUser } from "../../utils/notify.js";

const REPORT_REASONS = Message.schema.path("reportReason").enumValues;

// Finds the current active representative of a community, if any
const findActiveRep = (communityId) =>
  User.findOne({
    role: "representative",
    "representativeInfo.community": communityId,
    "representativeInfo.isActive": true,
  });

// Whether the logged-in user may read/write in this conversation:
// its own citizen, or the community's current active representative, or an admin
//
// `conversation.citizen`/`.community` may be a raw ObjectId OR a populated
// document (getConversationMessages populates both before calling this) —
// a populated Mongoose document's .toString() is NOT its id, so this always
// unwraps to the underlying _id first.
const canAccessConversation = async (conversation, user) => {
  if (user.role === "admin") return true;

  const citizenId = conversation.citizen._id || conversation.citizen;
  const communityId = conversation.community._id || conversation.community;

  if (citizenId.toString() === user._id.toString()) return true;

  if (
    user.role === "representative" &&
    user.representativeInfo?.isActive &&
    user.representativeInfo?.community?.toString() === communityId.toString()
  ) {
    return true;
  }

  return false;
};

// @desc   Start (or resume) the one open conversation with your community's
//         current representative — reopens the existing thread if there is one
// @route  POST /api/messages/conversations
export const startConversation = asyncHandler(async (req, res) => {
  if (!req.user.community) {
    return errorResponse(
      res,
      "You need to join a community before messaging its representative",
      400,
    );
  }

  const representative = await findActiveRep(req.user.community);

  if (!representative) {
    return errorResponse(
      res,
      "Your community doesn't have a representative yet",
      400,
    );
  }

  // findOneAndUpdate + upsert makes this idempotent: calling it again just
  // returns the same thread rather than erroring on the unique index
  const conversation = await Conversation.findOneAndUpdate(
    { citizen: req.user._id, community: req.user.community },
    { $setOnInsert: { citizen: req.user._id, community: req.user.community } },
    { new: true, upsert: true },
  ).populate("community", "name");

  res.status(200).json({
    conversation,
    representative: {
      _id: representative._id,
      name: representative.name,
      avatarUrl: representative.avatarUrl,
    },
  });
});

// @desc   List the logged-in user's conversations — their own (citizen), or
//         every citizen's thread in the community they represent (rep)
// @route  GET /api/messages/conversations
export const getMyConversations = asyncHandler(async (req, res) => {
  const isActiveRep =
    req.user.role === "representative" && req.user.representativeInfo?.isActive;

  const filter = isActiveRep
    ? { community: req.user.representativeInfo.community }
    : { citizen: req.user._id };

  const conversations = await Conversation.find(filter)
    .populate("citizen", "name avatarUrl")
    .populate("community", "name")
    .sort("-lastMessageAt");

  // Attach a last-message preview and unread count per conversation —
  // cheap enough per-conversation since a citizen/rep only ever has a
  // handful of these open at once.
  const withPreviews = await Promise.all(
    conversations.map(async (conversation) => {
      const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({
          conversation: conversation._id,
          moderationStatus: { $ne: "hidden" },
        }).sort("-createdAt"),
        Message.countDocuments({
          conversation: conversation._id,
          sender: { $ne: req.user._id },
          isRead: false,
          moderationStatus: { $ne: "hidden" },
        }),
      ]);

      return {
        ...conversation.toObject(),
        lastMessage: lastMessage
          ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
          : null,
        unreadCount,
      };
    }),
  );

  res.json({ conversations: withPreviews });
});

// @desc   Get a conversation's messages — marks the other party's messages read
// @route  GET /api/messages/conversations/:conversationId
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId)) {
    return errorResponse(res, "Invalid conversation id", 400);
  }

  const conversation = await Conversation.findById(conversationId)
    .populate("citizen", "name avatarUrl")
    .populate("community", "name");

  if (!conversation) {
    return errorResponse(res, "Conversation not found", 404);
  }

  if (!(await canAccessConversation(conversation, req.user))) {
    return errorResponse(res, "You don't have access to this conversation", 403);
  }

  const messages = await Message.find({
    conversation: conversation._id,
    moderationStatus: { $ne: "hidden" },
  })
    .populate("sender", "name avatarUrl role representativeInfo.isVerifiedOfficial")
    .sort({ createdAt: 1 });

  // Mark whatever the other party sent as read, now that this side has opened it
  await Message.updateMany(
    {
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      isRead: false,
    },
    { $set: { isRead: true } },
  );

  const representative = await findActiveRep(conversation.community._id);

  res.json({
    conversation,
    representative: representative
      ? { _id: representative._id, name: representative.name }
      : null,
    messages,
  });
});

// @desc   Send a message into an existing conversation
// @route  POST /api/messages/conversations/:conversationId
export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(conversationId)) {
    return errorResponse(res, "Invalid conversation id", 400);
  }

  if (!content || !content.trim()) {
    return errorResponse(res, "Message content is required", 400);
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return errorResponse(res, "Conversation not found", 404);
  }

  if (!(await canAccessConversation(conversation, req.user))) {
    return errorResponse(res, "You don't have access to this conversation", 403);
  }

  if (req.user.role === "admin") {
    return errorResponse(
      res,
      "Admins can moderate messages but can't send them",
      403,
    );
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    content: content.trim(),
  });

  conversation.lastMessageAt = new Date();
  await conversation.save();

  await message.populate(
    "sender",
    "name avatarUrl role representativeInfo.isVerifiedOfficial",
  );

  // Notify whichever side didn't just send this message
  const isCitizenSending =
    conversation.citizen.toString() === req.user._id.toString();

  if (isCitizenSending) {
    const representative = await findActiveRep(conversation.community);

    if (representative) {
      await notifyUser({
        recipient: representative._id,
        type: "new_message",
        message: `${req.user.name} sent you a message`,
        relatedConversation: conversation._id,
      });
    }
  } else {
    await notifyUser({
      recipient: conversation.citizen,
      type: "new_message",
      message: `${req.user.name} (your representative) sent you a message`,
      relatedConversation: conversation._id,
    });
  }

  res.status(201).json({
    message: "Message sent",
    data: message,
  });
});

// @desc   Report a message
// @route  POST /api/messages/:messageId/report
export const reportMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { reason, details } = req.body;

  if (!mongoose.isValidObjectId(messageId)) {
    return errorResponse(res, "Invalid message id", 400);
  }

  if (!REPORT_REASONS.includes(reason)) {
    return errorResponse(
      res,
      `reason must be one of: ${REPORT_REASONS.join(", ")}`,
      400,
    );
  }

  const message = await Message.findOne({
    _id: messageId,
    moderationStatus: "visible",
  });

  if (!message) {
    return errorResponse(res, "Message not found", 404);
  }

  const conversation = await Conversation.findById(message.conversation);

  if (!conversation || !(await canAccessConversation(conversation, req.user))) {
    return errorResponse(res, "You don't have access to this message", 403);
  }

  message.moderationStatus = "flagged";
  message.reportReason = reason;
  message.reportDetails = details?.trim() || undefined;
  await message.save();

  res.json({ message: "Message reported successfully" });
});
