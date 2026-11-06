/// <reference types="vite/client" />

declare module 'read-excel-file/browser' {
  export default function readXlsxFile(
    file: Blob | File | ArrayBuffer,
    options?: any
  ): Promise<any[][]>;
}