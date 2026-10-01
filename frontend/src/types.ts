export type InvoiceStatus = 'pending' | 'processing' | 'done' | 'needs_review' | 'rejected';

export interface LineItem {
  nazwa:      string;
  ilosc:      number;
  cena_netto: number;
  vat_rate:   number;
  brutto:     number;
  netto?:     number;
}

export interface Party {
  nazwa: string;
  nip:   string;
}

export interface ExtractedData {
  seller:            Party;
  buyer:             Party;
  kontrahent:        string;
  nip:               string;
  kwota_brutto:      number;
  waluta:            string;
  numer_faktury:     string;
  data_wystawienia:  string;
  pozycje:           LineItem[];
  _model?:            string;
  _processing_ms?:    number;
  _validation_ok?:    boolean;
  _validation_notes?: string[];
}

export interface Invoice {
  id:         string;
  status:     InvoiceStatus;
  raw_text:   string;
  filename:   string | null;
  extracted:  ExtractedData | null;
  erp_ref:    string | null;
  error_msg:  string | null;
  created_at: string;
  updated_at: string;
}
