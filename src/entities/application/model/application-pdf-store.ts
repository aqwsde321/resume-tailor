const DATABASE_NAME = "resume-tailor.application-pdfs.v1";
const STORE_NAME = "application-pdfs";

interface StoredApplicationPdf {
  id: string;
  blob: Blob;
}

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("이 브라우저에서는 지원 PDF를 저장할 수 없어요."));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("지원 PDF 저장소를 열지 못했어요."));
    request.onblocked = () => reject(new Error("지원 PDF 저장소를 여는 중 다른 탭의 응답을 기다리고 있어요."));
  });
}

function runTransaction<T>(
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  mode: IDBTransactionMode
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        try {
          const transaction = database.transaction(STORE_NAME, mode);
          const request = operation(transaction.objectStore(STORE_NAME));
          let result: T | undefined;

          request.onsuccess = () => {
            result = request.result;
          };
          transaction.oncomplete = () => {
            database.close();
            resolve(result as T);
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error ?? new Error("지원 PDF 저장소에 접근하지 못했어요."));
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error ?? new Error("지원 PDF 처리가 취소됐어요."));
          };
        } catch (error) {
          database.close();
          reject(error);
        }
      })
  );
}

export async function saveApplicationPdf(id: string, blob: Blob) {
  await runTransaction(
    (store) => store.put({ id, blob } satisfies StoredApplicationPdf),
    "readwrite"
  );
}

export async function getApplicationPdf(id: string): Promise<Blob | null> {
  const record = await runTransaction<StoredApplicationPdf | undefined>((store) => store.get(id), "readonly");
  return record?.blob ?? null;
}

export async function deleteApplicationPdf(id: string) {
  await runTransaction((store) => store.delete(id), "readwrite");
}
