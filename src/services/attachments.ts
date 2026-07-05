import { invoke } from "@tauri-apps/api/core";

interface SavedAttachment {
  name: string;
  mimeType: string;
  path: string;
  size: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function saveAttachmentForModel(file: File) {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke<SavedAttachment>("save_attachment", {
    request: {
      name: file.name,
      mimeType: file.type,
      bytes,
    },
  });
}

export async function buildUserInputWithAttachmentReferences(text: string, files: File[]) {
  if (files.length === 0) return text.trim();

  const attachmentBlocks = await Promise.all(files.map(async (file, index) => {
    const header = `附件 ${index + 1}: ${file.name}\n类型: ${file.type || "未知"}\n大小: ${formatBytes(file.size)}`;

    try {
      const saved = await saveAttachmentForModel(file);
      return `${header}\n路径: ${saved.path}`;
    } catch (error) {
      return `${header}\n路径: [保存失败：${error instanceof Error ? error.message : "未知错误"}]`;
    }
  }));

  const userText = text.trim() || "请阅读附件内容。";
  return `${userText}\n\n---\n附件已上传到本地。不要根据附件名猜测内容；需要查看附件正文时，请调用 FileRead 读取对应路径。\n\n${attachmentBlocks.join("\n\n")}`;
}
