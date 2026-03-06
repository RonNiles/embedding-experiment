import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadPDF() {
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:5000/upload-pdf", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      alert("Indexed: " + data.chunks + " chunks");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [] },
    onDrop
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: "2px dashed #888",
        padding: "40px",
        textAlign: "center",
        marginBottom: "20px"
      }}
    >
      <input {...getInputProps()} />
      Drag & drop PDF here
    </div>
  );
}
