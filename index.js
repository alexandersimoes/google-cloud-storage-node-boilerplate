import multer, {memoryStorage} from "multer";
import express from "express";
import storage from "@google-cloud/storage";
import path from "path";

// Instantiate a storage client
const googleCloudStorage = storage({
  projectId: process.env.GCLOUD_STORAGE_BUCKET,
  keyFilename: process.env.GCLOUD_KEY_FILE
});

// Instantiate an express server
const app = express();

// Multer is required to process file uploads and make them available via
// req.files.
const m = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // no larger than 5mb
  }
});

// A bucket is a container for objects (files).
const bucket = googleCloudStorage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

// Display a form for uploading files.
app.get("/", (req, res) => {
  res.sendFile(path.join(`${__dirname}/index.html`));
});

// Process the file upload and upload to Google Cloud Storage.
app.post("/upload", m.single("file"), (req, res, next) => {
  if (!req.file) {
    res.status(400).send("No file uploaded.");
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);

  // Make sure to set the contentType metadata for the browser to be able
  // to render the image instead of downloading the file (default behavior)
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: req.file.mimetype
    }
  });

  blobStream.on("error", err => {
    next(err);
    return;
  });

  blobStream.on("finish", () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

    // Make the image public to the web (since we'll be displaying it in browser)
    blob.makePublic().then(() => {
      res.status(200).send(`Success!\n Image uploaded to ${publicUrl}`);
    });
  });

  blobStream.end(req.file.buffer);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
