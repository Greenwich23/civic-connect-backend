import Notification from "../models/Notification.js";

/**
 * Creates a notification for a single recipient.
 */
export const notifyUser = async ({
  recipient,
  type,
  message,
  relatedIssue,
}) => {
  if (!recipient) return;

  await Notification.create({
    recipient,
    type,
    message,
    relatedIssue,
  });
};

/**
 * Creates the same notification for many recipients at once
 * (e.g. everyone who saved/followed an issue).
 */
export const notifyManyUsers = async ({
  recipients,
  type,
  message,
  relatedIssue,
}) => {
  if (!recipients?.length) return;

  const docs = recipients.map((recipientId) => ({
    recipient: recipientId,
    type,
    message,
    relatedIssue,
  }));

  await Notification.insertMany(docs);
};

/**
 * Notifies everyone currently following (i.e. who saved) a given issue.
 * Excludes the actor themselves, so you don't notify someone about their own action.
 */
export const notifyIssueFollowers = async ({
  issue,
  type,
  message,
  excludeUserId,
}) => {
  const User = (await import("../models/User.js")).default;

  const followers = await User.find({
    savedIssues: issue._id,
    _id: { $ne: excludeUserId },
  }).select("_id");

  await notifyManyUsers({
    recipients: followers.map((f) => f._id),
    type,
    message,
    relatedIssue: issue._id,
  });
};
