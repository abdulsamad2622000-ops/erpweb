export interface PutawayInput {
  binBarcode: string;
  serials: string[];
}

export interface PutawayResult {
  moved: number;
  bin: string;
}