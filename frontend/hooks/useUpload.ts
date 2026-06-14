"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { DocumentStatus, UploadProgress } from "@/lib/types";
import { generateId } from "@/lib/utils";

export function useUpload() {
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToQueue = useCallback((file: File): string => {
    const fileId = generateId();
    const newItem: UploadProgress = {
      fileId,
      filename: file.name,
      size: file.size,
      status: DocumentStatus.UPLOADING,
      progress: 0,
    };
    setUploadQueue((prev) => [...prev, newItem]);
    return fileId;
  }, []);

  const updateQueueItem = useCallback(
    (fileId: string, updates: Partial<UploadProgress>) => {
      setUploadQueue((prev) =>
        prev.map((item) => (item.fileId === fileId ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const removeFromQueue = useCallback((fileId: string) => {
    // Clear any polling interval
    const interval = pollingRefs.current.get(fileId);
    if (interval) {
      clearInterval(interval);
      pollingRefs.current.delete(fileId);
    }
    setUploadQueue((prev) => prev.filter((item) => item.fileId !== fileId));
  }, []);

  const startPolling = useCallback(
    (fileId: string, documentId: string) => {
      const poll = async () => {
        try {
          const statusResponse = await api.documents.getStatus(documentId);
          
          const progressMap: Record<string, number> = {
            [DocumentStatus.UPLOADING]: 10,
            [DocumentStatus.PARSING]: 30,
            [DocumentStatus.OCR_PROCESSING]: 50,
            [DocumentStatus.CLASSIFYING]: 70,
            [DocumentStatus.CREATING_EMBEDDINGS]: 90,
            [DocumentStatus.INDEXED]: 100,
            [DocumentStatus.ERROR]: 100,
          };

          updateQueueItem(fileId, {
            status: statusResponse.status,
            progress: progressMap[statusResponse.status] ?? statusResponse.progress,
            documentId,
          });

          if (
            statusResponse.status === DocumentStatus.INDEXED ||
            statusResponse.status === DocumentStatus.ERROR
          ) {
            const interval = pollingRefs.current.get(fileId);
            if (interval) {
              clearInterval(interval);
              pollingRefs.current.delete(fileId);
            }
            if (statusResponse.status === DocumentStatus.ERROR) {
              updateQueueItem(fileId, {
                error: "Processing failed. Please try again.",
              });
            }
          }
        } catch {
          // Silently fail polling errors
        }
      };

      const interval = setInterval(poll, 2000);
      pollingRefs.current.set(fileId, interval);
      poll(); // immediate first poll
    },
    [updateQueueItem]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = addToQueue(file);

      try {
        // Simulate progress during upload
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress = Math.min(progress + 5, 15);
          updateQueueItem(fileId, { progress });
        }, 200);

        const document = await api.documents.upload(file, (uploadProgress) => {
          updateQueueItem(fileId, {
            progress: Math.floor(uploadProgress * 0.15), // Upload is 0-15%
          });
        });

        clearInterval(progressInterval);

        updateQueueItem(fileId, {
          status: DocumentStatus.PARSING,
          progress: 20,
          documentId: document.id,
        });

        // Start polling for processing status
        startPolling(fileId, document.id);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        updateQueueItem(fileId, {
          status: DocumentStatus.ERROR,
          progress: 100,
          error: errorMessage,
        });
      }
    },
    [addToQueue, updateQueueItem, startPolling]
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      await Promise.all(files.map((file) => uploadFile(file)));
    },
    [uploadFile]
  );

  const clearCompleted = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) =>
          item.status !== DocumentStatus.INDEXED &&
          item.status !== DocumentStatus.ERROR
      )
    );
  }, []);

  return {
    uploadQueue,
    uploadFile,
    uploadFiles,
    removeFromQueue,
    clearCompleted,
  };
}
