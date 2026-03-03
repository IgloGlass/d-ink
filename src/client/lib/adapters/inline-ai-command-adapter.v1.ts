export type InlineAiCommandPreviewResultV1 = {
  command: string;
  impactedRows: number;
  previewMessage: string;
};

export interface InlineAiCommandAdapterV1 {
  preview: (input: {
    command: string;
    selectedRowIds: string[];
  }) => InlineAiCommandPreviewResultV1;
}

export const inlineAiCommandAdapterV1: InlineAiCommandAdapterV1 = {
  preview: ({ command, selectedRowIds }) => {
    const rowCount = selectedRowIds.length;
    return {
      command,
      impactedRows: rowCount,
      previewMessage:
        rowCount > 0
          ? `Preview prepared for ${rowCount} selected rows.`
          : "Preview prepared for all visible rows.",
    };
  },
};
