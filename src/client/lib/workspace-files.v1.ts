import type { TrialBalanceFileTypeV1 } from "../../shared/contracts/trial-balance.v1";

export function inferTrialBalanceFileTypeV1(
  fileName: string,
): TrialBalanceFileTypeV1 | undefined {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (lowerName.endsWith(".xlsx")) {
    return "xlsx";
  }
  if (lowerName.endsWith(".xls")) {
    return "xls";
  }

  return undefined;
}

export async function fileToBase64V1(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error(`Failed to read file ${file.name}.`));
    };

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read file ${file.name}.`));
        return;
      }

      const [, base64Content = ""] = result.split(",", 2);
      resolve(base64Content);
    };

    reader.readAsDataURL(file);
  });
}
