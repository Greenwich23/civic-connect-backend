import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Separate storage configs per use case,
// so files land in organized folders.

const issueEvidenceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "community-platform/issues",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const representativeDocsStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "community-platform/representative-applications",
    allowed_formats: ["jpg", "png", "jpeg", "pdf"],
  },
});

const resolutionPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "community-platform/resolutions",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "community-platform/avatars",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

export const uploadAvatar = multer({ storage: avatarStorage });

export const uploadIssueEvidence = multer({
  storage: issueEvidenceStorage,
});

export const uploadRepresentativeDocs = multer({
  storage: representativeDocsStorage,
});

export const uploadResolutionPhoto = multer({
  storage: resolutionPhotoStorage,
});
