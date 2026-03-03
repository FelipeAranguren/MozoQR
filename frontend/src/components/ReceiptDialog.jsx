// frontend/src/components/ReceiptDialog.jsx
// Recibo en modal - funciona siempre, sin depender de popups
import React, { useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Divider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';

const money = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
};

const fmtDateTime = (d) => {
  try {
    return (d instanceof Date ? d : new Date(d)).toLocaleString('es-AR');
  } catch {
    return '';
  }
};

export default function ReceiptDialog({ open, onClose, receiptData }) {
  const printRef = useRef(null);

  if (!receiptData) return null;

  const restaurant = receiptData.restaurant || {};
  const legalName = restaurant.billing_legal_name || restaurant.name || 'Restaurante';
  const items = (receiptData.items || []).map((it) => {
    const qty = Math.max(1, Number(it?.quantity || it?.qty || 1) || 1);
    const unitPrice = Number(it?.unitPrice ?? it?.price ?? 0) || 0;
    const total = Number(it?.totalPrice ?? it?.total ?? 0) || (unitPrice * qty);
    return {
      name: String(it?.name || it?.productName || 'Producto').slice(0, 80),
      qty,
      unitPrice,
      total: total > 0 ? total : unitPrice * qty,
    };
  });
  const subtotal = receiptData.subtotal != null ? Number(receiptData.subtotal) : items.reduce((s, l) => s + (l.total || 0), 0);
  const discount = Number(receiptData.discount || 0) || 0;
  const tipAmount = Number(receiptData.tipAmount || 0) || 0;
  const total = receiptData.total != null ? Number(receiptData.total) : Math.max(0, subtotal - discount + tipAmount);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const html = buildReceiptHtml(receiptData, items, subtotal, discount, tipAmount, total, legalName);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-mesa-${receiptData.mesaNumber || 'cuenta'}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [role="dialog"], [role="dialog"] * { visibility: hidden !important; }
          .receipt-print-area,
          .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 12px !important;
            background: white !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: 'no-print' }}>
        <DialogTitle sx={{ pb: 0 }}>Comprobante de cuenta</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box
            ref={printRef}
            className="receipt-print-area"
            sx={{
              maxWidth: 320,
              mx: 'auto',
              p: 2.5,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'grey.50',
            }}
          >
            {/* Encabezado - estilo ticket */}
            <Box sx={{ textAlign: 'center', mb: 1.5 }}>
              <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 1, fontSize: '1.1rem' }}>
                {legalName}
              </Typography>
              <Typography variant="caption" color="text.secondary">CUENTA / TICKET</Typography>
            </Box>
            <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', mb: 1 }}>
              <span>Mesa</span>
              <span><strong>{receiptData.mesaNumber ?? '—'}</strong></span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', mb: 1 }}>
              <span>Fecha</span>
              <span>{fmtDateTime(receiptData.paidAt || new Date())}</span>
            </Box>
            {receiptData.paymentMethod && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', mb: 1.5 }}>
                <span>Forma de pago</span>
                <span>{receiptData.paymentMethod}</span>
              </Box>
            )}
            <Divider sx={{ my: 1.5 }} />
            {/* Items */}
            <Table size="small" sx={{ '& td': { border: 'none', py: 0.5, fontSize: '0.875rem' } }}>
              <TableBody>
                {items.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ width: 50 }}><strong>{line.qty}x</strong></TableCell>
                    <TableCell>{line.name}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(line.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Divider sx={{ my: 1.5 }} />
            {/* Totales */}
            <Box sx={{ fontSize: '0.9rem' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </Box>
              {discount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, color: 'success.main' }}>
                  <span>Descuento</span>
                  <span>-{money(discount)}</span>
                </Box>
              )}
              {tipAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, color: 'primary.main' }}>
                  <span>Propina</span>
                  <span>{money(tipAmount)}</span>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontWeight: 700, fontSize: '1rem' }}>
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </Box>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" display="block" align="center" color="text.secondary">
              Documento interno / no fiscal
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }} className="no-print">
          <Button onClick={onClose}>Cerrar</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload}>
            Descargar HTML
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
            Imprimir / Guardar PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function buildReceiptHtml(receiptData, items, subtotal, discount, tipAmount = 0, total, legalName) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
  };
  const fmt = (d) => {
    try { return (d instanceof Date ? d : new Date(d)).toLocaleString('es-AR'); } catch { return ''; }
  };
  const linesHtml = items.map((l) =>
    `<tr><td><strong>${l.qty}x</strong></td><td>${esc(l.name)}</td><td style="text-align:right">${money(l.total)}</td></tr>`
  ).join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo</title>
<style>
body{font-family:system-ui,sans-serif;max-width:80mm;margin:20px auto;padding:16px;font-size:14px}
h1{text-align:center;font-size:16px;margin:0 0 12px}
hr{border:none;border-top:1px dashed #999;margin:12px 0}
table{width:100%;border-collapse:collapse}td{padding:4px 0}
.tot{display:flex;justify-content:space-between;margin:4px 0}
.grand{font-weight:700;font-size:16px;margin-top:8px}
.foot{font-size:11px;color:#666;text-align:center;margin-top:12px}
@media print{body{margin:0;padding:8px}}
</style></head><body>
<h1>${esc(legalName)}</h1><hr>
<div class="tot"><span>Mesa</span><strong>${esc(receiptData.mesaNumber ?? '—')}</strong></div>
<div class="tot"><span>Fecha</span>${esc(fmt(receiptData.paidAt || new Date()))}</div>
${receiptData.paymentMethod ? `<div class="tot"><span>Pago</span>${esc(receiptData.paymentMethod)}</div>` : ''}
<hr>
<table><tbody>${linesHtml}</tbody></table>
<hr>
<div class="tot"><span>Subtotal</span>${money(subtotal)}</div>
${discount > 0 ? `<div class="tot" style="color:green"><span>Descuento</span>-${money(discount)}</div>` : ''}
${(tipAmount || 0) > 0 ? `<div class="tot" style="color:#1976d2"><span>Propina</span>${money(tipAmount)}</div>` : ''}
<div class="tot grand"><span>TOTAL</span>${money(total)}</div>
<hr>
<p class="foot">Documento interno / no fiscal</p>
</body></html>`;
}
