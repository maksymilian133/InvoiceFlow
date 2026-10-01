import 'dotenv/config';
import express from 'express';

const app  = express();
const PORT = process.env.ERP_PORT ?? 3001;

app.use(express.json());

const erpInvoices: Record<string, unknown>[] = [];

app.get('/odata/v1/$metadata', (_req, res) => {
  res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="InvoiceFlow.ERP" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Invoice">
        <Key><PropertyRef Name="InvoiceId"/></Key>
        <Property Name="InvoiceId"     Type="Edm.String" Nullable="false"/>
        <Property Name="Vendor"        Type="Edm.String"/>
        <Property Name="VendorTaxId"   Type="Edm.String"/>
        <Property Name="GrossAmount"   Type="Edm.Decimal"/>
        <Property Name="Currency"      Type="Edm.String"/>
        <Property Name="InvoiceNumber" Type="Edm.String"/>
        <Property Name="InvoiceDate"   Type="Edm.Date"/>
        <Property Name="ErpRef"        Type="Edm.String"/>
        <Property Name="CreatedAt"     Type="Edm.DateTimeOffset"/>
      </EntityType>
      <EntityContainer Name="Container">
        <EntitySet Name="Invoices" EntityType="InvoiceFlow.ERP.Invoice"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`);
});

app.get('/odata/v1/Invoices', (_req, res) => {
  res.json({
    '@odata.context': '/odata/v1/$metadata#Invoices',
    value: erpInvoices,
  });
});

app.get('/odata/v1/Invoices/:id', (req, res) => {
  const params = req.params as unknown as Record<string, string>;
  const rawId  = params.id.replace(/^'|'$/g, '');
  const inv    = erpInvoices.find((i) => (i as { InvoiceId: string }).InvoiceId === rawId);
  if (!inv) return res.status(404).json({ error: 'Nie znaleziono' });
  res.json(inv);
});

app.post('/odata/v1/Invoices', (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!body.InvoiceId) {
    return res.status(400).json({ error: 'Brak InvoiceId' });
  }

  const erpRef = `ERP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const record = { ...body, ErpRef: erpRef, CreatedAt: new Date().toISOString() };

  erpInvoices.push(record);

  res.status(201).json({
    '@odata.context': '/odata/v1/$metadata#Invoices/$entity',
    ...record,
  });
});

app.delete('/odata/v1/Invoices/:id', (req, res) => {
  const params = req.params as unknown as Record<string, string>;
  const rawId  = params.id.replace(/^'|'$/g, '');
  const idx    = erpInvoices.findIndex((i) => (i as { InvoiceId: string }).InvoiceId === rawId);
  if (idx === -1) return res.status(404).json({ error: 'Nie znaleziono' });
  erpInvoices.splice(idx, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`erp listening on http://localhost:${PORT}`);
});
