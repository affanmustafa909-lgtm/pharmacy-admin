import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { useDashboard } from '../context/DashboardContext'
import { API_BASE, apiFetch } from '../services/http'

const FIELDS = ['storeCode', 'sku', 'name', 'brand', 'category', 'unitLabel', 'price', 'stock', 'description', 'rxRequired', 'onlineSale', 'batch', 'expiry', 'imageUrl'] as const

type Field = (typeof FIELDS)[number]
type MapState = Record<Field, string>

interface PreviewRow {
  rowNumber: number
  values: Record<string, string>
  errors: string[]
  duplicate: boolean
}

interface UploadPayload {
  headers: string[]
  rawRows: string[][]
  embeddedImageUrls?: string[]
  suggestedMap: MapState
  rows: PreviewRow[]
}

const EMPTY_MAP = Object.fromEntries(FIELDS.map((field) => [field, ''])) as MapState

function imageSrc(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

export function ProductImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify, reload, activeStore, snapshot } = useDashboard()
  const pharmacies = snapshot?.pharmacies ?? []
  const [pickedStoreId, setPickedStoreId] = useState('')
  const targetStore = activeStore ?? pharmacies.find((item) => item.id === pickedStoreId) ?? null
  const fileRef = useRef<HTMLInputElement>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [embeddedImageUrls, setEmbeddedImageUrls] = useState<string[]>([])
  const [map, setMap] = useState<MapState>(EMPTY_MAP)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [strategy, setStrategy] = useState<'skip' | 'update' | 'reject'>('update')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [fileLabel, setFileLabel] = useState('')
  const [lastFailed, setLastFailed] = useState<{ rowNumber: number; errors: string[]; values?: Record<string, string> }[]>([])

  function clearFileInput() {
    if (fileRef.current) fileRef.current.value = ''
  }

  function resetState() {
    setHeaders([])
    setRawRows([])
    setEmbeddedImageUrls([])
    setMap(EMPTY_MAP)
    setRows([])
      setStrategy('update')
    setBusy(false)
    setNote('')
    setFileLabel('')
    setLastFailed([])
    clearFileInput()
  }

  function mapWithStoreCode(base: MapState, store = targetStore): MapState {
    if (!store?.code) return base
    return { ...base, storeCode: store.code }
  }

  useEffect(() => {
    if (!open) {
      resetState()
      setPickedStoreId('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !targetStore?.code) return
    setMap((current) => mapWithStoreCode(current))
  }, [open, targetStore?.code])

  function chooseStore(id: string) {
    setPickedStoreId(id)
    const store = pharmacies.find((item) => item.id === id)
    if (!store) return
    if (headers.length > 0) {
      const next = mapWithStoreCode(map, store)
      setMap(next)
      void refreshPreviewWith(next, headers, rawRows, embeddedImageUrls, store)
    }
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function downloadTemplate() {
    const blob = (await apiFetch('/admin/products/import/template')) as Blob
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hera-products-template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!targetStore) {
      setNote('Choose the store first, then choose the Excel file.')
      clearFileInput()
      return
    }
    setBusy(true)
    setNote('')
    setFileLabel(file.name)
    try {
      const body = new FormData()
      body.append('file', file)
      const payload = (await apiFetch('/admin/products/import/upload', { method: 'POST', body })) as UploadPayload
      setHeaders(payload.headers)
      setRawRows(payload.rawRows)
      setEmbeddedImageUrls(payload.embeddedImageUrls ?? [])
      const suggested = mapWithStoreCode(payload.suggestedMap)
      setMap(suggested)
      setRows(payload.rows)
      if (targetStore?.code && suggested.storeCode) {
        void refreshPreviewWith(suggested, payload.headers, payload.rawRows, payload.embeddedImageUrls ?? [])
      }
      setNote(`Loaded ${payload.rows.length} row${payload.rows.length === 1 ? '' : 's'} from ${file.name}. Choose Excel again anytime to replace.`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not read that file')
      setHeaders([])
      setRawRows([])
      setEmbeddedImageUrls([])
      setRows([])
    } finally {
      clearFileInput()
      setBusy(false)
    }
  }

  async function refreshPreviewWith(
    nextMap: MapState,
    nextHeaders = headers,
    nextRawRows = rawRows,
    nextEmbedded = embeddedImageUrls,
    store = targetStore,
  ) {
    if (nextHeaders.length === 0) return
    setBusy(true)
    try {
      const payload = (await apiFetch('/admin/products/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          headers: nextHeaders,
          rawRows: nextRawRows,
          embeddedImageUrls: nextEmbedded,
          map: nextMap,
          storeId: store?.id,
          storeCode: store?.code,
        }),
      })) as { rows: PreviewRow[] }
      setRows(payload.rows)
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function refreshPreview(nextMap: MapState) {
    await refreshPreviewWith(nextMap)
  }

  async function commit() {
    setBusy(true)
    setNote('')
    try {
      const result = (await apiFetch('/admin/products/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          headers,
          rawRows,
          embeddedImageUrls,
          map,
          duplicateStrategy: strategy,
          storeId: targetStore?.id,
          storeCode: targetStore?.code,
        }),
      })) as {
        saved: number
        skipped: number
        failed: { rowNumber: number; errors: string[]; values?: Record<string, string> }[]
        imported?: number
      }
      await reload()
      const imported = result.imported ?? result.saved
      const failedCount = result.failed?.length ?? 0
      notify(`Imported ${imported}, skipped ${result.skipped}${failedCount ? `, failed ${failedCount}` : ''}`)
      if (failedCount) {
        setLastFailed(result.failed)
        setNote(
          `${failedCount} row${failedCount === 1 ? '' : 's'} failed.\n${result.failed
            .map((row) => `Row ${row.rowNumber}: ${row.errors.join('; ')}`)
            .join('\n')}`,
        )
        return
      }
      resetState()
      onClose()
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const errorCount = rows.filter((row) => row.errors.length > 0).length
  const validRows = rows.filter((row) => row.errors.length === 0).length

  // Fix a value right in the preview table (no need to edit the Excel file again).
  function cellValue(index: number, field: Field) {
    const column = map[field] ? headers.indexOf(map[field]) : -1
    if (column < 0) return null
    return rawRows[index]?.[column] ?? ''
  }

  function editCell(index: number, field: Field, value: string) {
    const column = map[field] ? headers.indexOf(map[field]) : -1
    if (column < 0) return
    setRawRows((current) => current.map((row, i) => (i === index ? row.map((cell, j) => (j === column ? value : cell)) : row)))
  }

  function renderCell(index: number, field: Field, width: number) {
    const value = cellValue(index, field)
    if (value === null) return '—'
    return (
      <input
        className="select"
        style={{ width, padding: '4px 8px' }}
        value={value}
        onChange={(event) => editCell(index, field, event.target.value)}
        onBlur={() => void refreshPreviewWith(map)}
        aria-label={field}
      />
    )
  }

  function downloadFailedCsv() {
    if (!lastFailed.length) return
    const header = ['rowNumber', 'errors', ...Object.keys(lastFailed[0].values ?? {})]
    const body = lastFailed.map((row) => [
      String(row.rowNumber),
      row.errors.join('; '),
      ...header.slice(2).map((key) => row.values?.[key] ?? ''),
    ])
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hera-import-failed-rows.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      wide
      title="Import medicines"
      subtitle={targetStore ? `Importing into ${targetStore.name}${targetStore.code ? ` (${targetStore.code})` : ''}` : 'Choose the store, then pick the Excel file.'}
      onClose={handleClose}
    >
      {!activeStore ? (
        <label className="field">Import into which store?
          <select value={pickedStoreId} onChange={(event) => chooseStore(event.target.value)}>
            <option value="">Choose store…</option>
            {pharmacies.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="btn-row">
        <button className="btn-soft" type="button" onClick={() => void downloadTemplate()}>Download template</button>
        <label className="btn-soft">
          {fileLabel ? 'Choose another Excel' : 'Choose Excel'}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        {headers.length > 0 ? (
          <button className="btn-soft" type="button" onClick={resetState}>Clear file</button>
        ) : null}
      </div>
      {targetStore?.code ? (
        <p className="sub">Store code <strong>{targetStore.code}</strong> is applied to every row.</p>
      ) : null}
      {headers.length > 0 ? (
        <div className="split mt">
          {FIELDS.map((field) => (
            <label className="field" key={field}>
              {field}
              <select
                value={field === 'storeCode' && targetStore?.code ? targetStore.code : map[field]}
                disabled={field === 'storeCode' && Boolean(targetStore?.code)}
                onChange={(event) => {
                  const next = { ...map, [field]: event.target.value }
                  setMap(next)
                  void refreshPreview(next)
                }}
              >
                <option value="">Not mapped</option>
                {headers.map((header) => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      <label className="field">If the same SKU is already in that store
        <select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}>
          <option value="update">Update existing product (recommended)</option>
          <option value="skip">Skip — do not change existing</option>
          <option value="reject">Stop import on duplicates</option>
        </select>
      </label>
      {strategy === 'skip' && rows.some((row) => row.duplicate && row.errors.length === 0) ? (
        <p className="sub">Skip selected: existing SKUs will not be added or changed. Choose “Update existing product” if you want them saved.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="table-wrap table-static mt">
          <table>
            <thead>
              <tr><th>Pic</th><th>Row</th><th>Name</th><th>SKU</th><th>Batch</th><th>Price</th><th>Stock</th><th>Expiry</th><th>Result</th></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const pic = row.values.imageUrl || embeddedImageUrls[index] || ''
                return (
                  <tr key={row.rowNumber}>
                    <td>
                      {pic ? (
                        <img className="product-thumb" src={imageSrc(pic)} alt="" />
                      ) : (
                        <span className="product-thumb product-thumb-empty">No pic</span>
                      )}
                    </td>
                    <td>{row.rowNumber}</td>
                    <td>{renderCell(index, 'name', 150)}</td>
                    <td>{renderCell(index, 'sku', 110)}</td>
                    <td>{renderCell(index, 'batch', 100)}</td>
                    <td>{renderCell(index, 'price', 70)}</td>
                    <td>{renderCell(index, 'stock', 70)}</td>
                    <td>{renderCell(index, 'expiry', 110)}</td>
                    <td className={row.errors.length ? 'import-error' : ''}>
                      {row.errors.length
                        ? row.errors.map((error, errorIndex) => (
                            <span key={`${row.rowNumber}-${errorIndex}`} className="tag off" style={{ display: 'block', marginBottom: 4 }}>{error}</span>
                          ))
                        : row.duplicate
                          ? strategy === 'update'
                            ? 'Will update'
                            : strategy === 'skip'
                              ? 'Will skip'
                              : 'Will reject'
                          : 'Will add'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <p className="sub mt">
          {validRows} valid · {errorCount} with errors
          {errorCount > 0 ? ' · Fix the highlighted rows right here in the table, then click outside the box to re-check.' : ''}
        </p>
      ) : null}
      {note ? <p className="sub mt" style={{ whiteSpace: 'pre-wrap' }}>{note}</p> : null}
      <div className="modal-actions">
        {lastFailed.length > 0 ? (
          <button className="btn-soft" type="button" onClick={downloadFailedCsv}>Download failed rows CSV</button>
        ) : null}
        <button className="btn-soft" type="button" onClick={handleClose}>Cancel</button>
        <button className="btn-dark" type="button" disabled={busy || validRows === 0} onClick={() => void commit()}>
          {busy ? 'Working…' : `Save import (${validRows} valid)`}
        </button>
      </div>
    </Modal>
  )
}
