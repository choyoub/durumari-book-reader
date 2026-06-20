import type { BookKind, OpenedBook } from "../types";

const supported = ["epub", "txt", "zip"] as const;

function extension(name: string): BookKind | null {
  const value = name.split(".").pop()?.toLowerCase();
  return supported.includes(value as BookKind) ? value as BookKind : null;
}

function makeId(name: string, size: number, modified: number) {
  return `${name}:${size}:${modified}`;
}

async function chooseInBrowser(): Promise<{ name: string; bytes: Uint8Array; modified: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".epub,.txt,.zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), modified: file.lastModified });
    };
    input.click();
  });
}

async function chooseInTauri(): Promise<{ name: string; bytes: Uint8Array; modified: number } | null> {
  const [{ open }, { readFile, stat }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs")
  ]);
  const path = await open({ multiple: false, filters: [{ name: "도서", extensions: [...supported] }] });
  if (!path) return null;
  const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
  return { name: path.split(/[\\/]/).pop() ?? path, bytes, modified: info.mtime?.getTime() ?? 0 };
}

function processText(name: string, kind: "txt" | "zip", bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/textWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      data.error ? reject(new Error(data.error)) : resolve(data.text);
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({ name, kind, bytes }, [bytes.buffer]);
  });
}

export async function pickBook(): Promise<OpenedBook | null> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  const selected = await (isTauri ? chooseInTauri() : chooseInBrowser());
  if (!selected) return null;
  const kind = extension(selected.name);
  if (!kind) throw new Error("지원하지 않는 파일 형식입니다.");
  const id = makeId(selected.name, selected.bytes.byteLength, selected.modified);
  if (kind === "epub") {
    const bytes = Uint8Array.from(selected.bytes).buffer;
    return { id, name: selected.name.replace(/\.epub$/i, ""), kind, bytes, openedAt: Date.now() };
  }
  const text = await processText(selected.name, kind, selected.bytes);
  return { id, name: selected.name.replace(/\.(txt|zip)$/i, ""), kind, text, openedAt: Date.now() };
}

async function fromSelection(name: string, bytes: Uint8Array, modified: number): Promise<OpenedBook | null> {
  const kind = extension(name);
  if (!kind) return null;
  const id = makeId(name, bytes.byteLength, modified);
  if (kind === "epub") return { id, name: name.replace(/\.epub$/i, ""), kind, bytes: Uint8Array.from(bytes).buffer, openedAt: modified || Date.now() };
  return { id, name: name.replace(/\.(txt|zip)$/i, ""), kind, rawBytes: Uint8Array.from(bytes).buffer, openedAt: modified || Date.now() };
}

export async function prepareBook(book: OpenedBook): Promise<OpenedBook> {
  if ((book.kind === "epub" && book.bytes) || book.text !== undefined) return book;
  let bytes: Uint8Array;
  if (book.file) bytes = new Uint8Array(await book.file.arrayBuffer());
  else if (book.path) bytes = await (await import("@tauri-apps/plugin-fs")).readFile(book.path);
  else if (book.rawBytes) bytes = new Uint8Array(book.rawBytes.slice(0));
  else throw new Error("도서 원본 데이터를 찾을 수 없습니다.");
  if (book.kind === "epub") return { ...book, bytes: Uint8Array.from(bytes).buffer };
  return { ...book, text: await processText(book.name, book.kind, Uint8Array.from(bytes)), rawBytes: undefined };
}

export async function selectLocalFolder(): Promise<{ path: string; handle?: any } | null> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const root = await open({ directory: true, multiple: false, recursive: true });
    if (!root) return null;
    return { path: root as string };
  } else {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
        return { path: handle.name, handle };
      } catch (e: any) {
        if (e.name === "AbortError") return null;
        console.warn("showDirectoryPicker failed", e);
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file"; input.multiple = true; input.setAttribute("webkitdirectory", "");
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = () => {
        let folderName = "";
        const files = Array.from(input.files ?? []);
        if (files.length > 0 && files[0].webkitRelativePath) {
          folderName = files[0].webkitRelativePath.split("/")[0];
        }
        input.remove(); resolve({ path: folderName || "로컬 폴더", handle: files });
      };
      input.addEventListener("cancel", () => { input.remove(); resolve(null); }, { once: true });
      input.click();
    });
  }
}

export async function scanLocalFolder(path: string, handle?: any): Promise<OpenedBook[]> {
  const isTauri = "__TAURI_INTERNALS__" in window;
  let books: OpenedBook[] = [];

  if (isTauri && path) {
    const [{ readDir, stat }, { join }] = await Promise.all([
      import("@tauri-apps/plugin-fs"), import("@tauri-apps/api/path")
    ]);
    const found: string[] = [];
    const walk = async (directory: string) => {
      try {
        const entries = await readDir(directory);
        for (const entry of entries) {
          const entryPath = await join(directory, entry.name);
          if (entry.isDirectory) {
            await walk(entryPath);
          } else if (entry.isFile && extension(entry.name)) {
            found.push(entryPath);
          }
        }
      } catch (e) {
        console.warn("Failed to read directory:", directory, e);
      }
    };
    await walk(path);
    const scanned = await Promise.all(
      found.map(async (filePath): Promise<OpenedBook | null> => {
        try {
          const info = await stat(filePath);
          const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
          const kind = extension(fileName)!;
          const modified = info.mtime?.getTime() ?? 0;
          return {
            id: makeId(fileName, info.size, modified),
            name: fileName.replace(/\.(epub|txt|zip)$/i, ""),
            kind,
            path: filePath,
            openedAt: modified || Date.now(),
          };
        } catch (e) { return null; }
      })
    );
    books = scanned.filter((book): book is OpenedBook => book !== null);
  } else if (handle) {
    if (Array.isArray(handle)) {
      books = handle.flatMap((file: File) => {
        const kind = extension(file.name);
        return kind ? [{ id: makeId(file.name, file.size, file.lastModified), name: file.name.replace(/\.(epub|txt|zip)$/i, ""), kind, file, openedAt: file.lastModified || Date.now() }] : [];
      });
    } else {
      const found: File[] = [];
      const walk = async (dirHandle: any) => {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && extension(entry.name)) {
            try {
              const file = await entry.getFile();
              found.push(file);
            } catch (e) {
              // File might have been deleted between values() and getFile()
            }
          } else if (entry.kind === 'directory') {
            await walk(entry);
          }
        }
      };
      await walk(handle);
      books = found.map(file => {
        const kind = extension(file.name)!;
        return { id: makeId(file.name, file.size, file.lastModified), name: file.name.replace(/\.(epub|txt|zip)$/i, ""), kind, file, openedAt: file.lastModified || Date.now() };
      });
    }
  }

  books.sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
  return books;
}
