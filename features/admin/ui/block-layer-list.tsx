"use client";

import { useState } from "react";

import { STYLE_CHOICES } from "@/lib/blocks/style";
import { BLOCK_CATALOG, type Block, type BlockDocument, type BlockLocation, type RowBlock } from "@/lib/blocks/types";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * เลเยอร์ของหน้า (รายการบล็อก) — รองรับ "บล็อกซ้อน" (X1.1)
 *
 * ผู้ใช้สั่งไว้ตั้งแต่ต้นว่า *"เมนูที่ใช้ปรับแต่ง … เอามาไว้ข้าง ๆ · กดส่วนไหนให้ส่วนนั้นออกมาปรับแต่ง"*
 * ⇒ ไฟล์นี้ทำหน้าที่ "สารบัญของหน้า" เท่านั้น: เลือก/ย้าย/ทำซ้ำ/ลบ ดำเนินการผ่าน callback
 * (ตรรกะจริงอยู่ใน `lib/blocks/edit.ts` ซึ่งมีเทสต์คุม — ไฟล์นี้ไม่มีตรรกะเอกสารเลย)
 *
 * ⚠️ **ลาก-วางต้องเรียก `dataTransfer.setData()` ตอน `dragstart`** (บทเรียนรอบที่ 51: Firefox ไม่เริ่มลากเลยถ้าไม่เรียก)
 * และอ่านค่าตอน `drop` จาก `dataTransfer` เอง (ไม่ใช้ ref — กันลำดับ `dragend` มาก่อน `drop`)
 */
export const DRAG_BLOCK_MIME = "application/x-waiwai-block";

/** คีย์ของ "ช่องรับการวาง" — เทียบกันได้ด้วยสตริงเดียว (ง่ายต่อการไฮไลต์) */
function dropKeyOf(target: BlockLocation): string {
  return `${target.rowId ?? ""}|${target.columnId ?? ""}|${target.index}`;
}

/** คีย์ปลายทางของ "ย้ายไป" (ระดับหน้า หรือคอลัมน์ของแถว) */
function moveTargetKeyOf(target: string): BlockLocation {
  if (target === "root") return { rowId: null, columnId: null, index: Number.MAX_SAFE_INTEGER };
  const [rowId, columnId] = target.split(":");
  return {
    rowId: rowId === undefined || rowId === "" ? null : rowId,
    columnId: columnId === undefined || columnId === "" ? null : columnId,
    index: Number.MAX_SAFE_INTEGER,
  };
}

type LayerHandlers = {
  readonly strings: Messages["admin"];
  readonly selectedId: string;
  readonly onSelect: (blockId: string) => void;
  readonly onMove: (blockId: string, delta: -1 | 1) => void;
  readonly onDuplicate: (blockId: string) => void;
  readonly onRemove: (blockId: string) => void;
  /** ย้ายบล็อกไปภาชนะ/ตำแหน่งที่กำหนด (ใช้ทั้งลากวางและเมนู "ย้ายไป") */
  readonly onMoveTo: (blockId: string, target: BlockLocation) => void;
  /** แถวทั้งหมดในหน้า (ใช้สร้างเมนู "ย้ายไป") */
  readonly rows: readonly RowBlock[];
};

function LayerItem({
  block,
  label,
  location,
  containerSize,
  handlers,
  dragging,
  setDragging,
  dropKey,
  setDropKey,
}: {
  readonly block: Block;
  readonly label: string;
  readonly location: BlockLocation;
  /** จำนวนบล็อกในภาชนะเดียวกัน (ใช้ปิดปุ่ม ↑ ↓ ที่ขอบ) */
  readonly containerSize: number;
  readonly handlers: LayerHandlers;
  readonly dragging: string | null;
  readonly setDragging: (blockId: string | null) => void;
  readonly dropKey: string | null;
  readonly setDropKey: (key: string | null) => void;
}) {
  const { strings } = handlers;
  const key = dropKeyOf(location);
  const isDropping = dropKey === key && dragging !== null && dragging !== block.id;
  const selected = handlers.selectedId === block.id;
  const typeLabel = BLOCK_CATALOG.find((entry) => entry.type === block.type)?.label ?? block.type;

  /* ปลายทางของ "ย้ายไป" — ระดับหน้า + ทุกคอลัมน์ของทุกแถว (แสดงเมื่อหน้ามีแถวเท่านั้น) */
  const rows = handlers.rows;
  const moveTargets = [
    { value: "root", label: strings.moveToRoot },
    ...rows.flatMap((row, rowIndex) =>
      row.columns.map((column, columnIndex) => ({
        value: `${row.id}:${column.id}`,
        label: fillTemplate(strings.addTargetColumn, { row: rowIndex + 1, column: columnIndex + 1 }),
      })),
    ),
  ];

  return (
    <li
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_BLOCK_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDropKey(key);
      }}
      onDrop={(event) => {
        const moving = event.dataTransfer.getData(DRAG_BLOCK_MIME);
        if (moving === "") return;
        event.preventDefault();
        event.stopPropagation();
        handlers.onMoveTo(moving, location);
        setDragging(null);
        setDropKey(null);
      }}
    >
      <div
        draggable
        onDragStart={(event) => {
          setDragging(block.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(DRAG_BLOCK_MIME, block.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDropKey(null);
        }}
        /*
          รอบที่ 236 (ฟีดแบ็กเจ้าของ: "คลิกโดนช่องเปล่า ๆ ของบล็อก ไม่เลื่อน")
          ⇒ ให้ **ทั้งแถว** คลิกเลือกได้ (เดิมมีเฉพาะตัวหนังสือหัวเรื่อง ⇒ ช่องว่างในแถวคลิกไม่ติด)
          ⚠️ ปุ่มย่อย (↑ ↓ ทำซ้ำ ลบ) ยังทำงานของตัวเอง — คลิกจะไม่ทะลุมาถึงแถวเพราะปุ่มเรียก stopPropagation
        */
        onClick={() => handlers.onSelect(block.id)}
        className={`flex flex-col gap-1 rounded-lg border p-2 transition-colors ${
          selected ? "border-brand-red bg-surface-raised" : "border-line hover:border-brand-red/60"
        } ${dragging === block.id ? "opacity-40" : ""} ${isDropping ? "border-t-brand-red border-t-4" : ""}`}
      >
        <div className="flex items-start gap-1.5">
          <span aria-hidden="true" title={strings.dragToMove} className="text-fg-muted shrink-0 cursor-grab text-xs leading-5 active:cursor-grabbing">
            ⠿
          </span>
          <button
            type="button"
            onClick={() => handlers.onSelect(block.id)}
            className="text-fg focus-visible:ring-ring w-full text-left text-xs font-semibold break-words focus-visible:ring-2 focus-visible:outline-none"
          >
            {label} · {typeLabel}
          </button>
        </div>

        {/* ปุ่มย่อยของแถว — หยุดการคลิกไม่ให้ทะลุไป "เลือกบล็อก" ของทั้งแถว (รอบที่ 236) */}
        <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
          <TinyButton label="↑" disabled={location.index === 0} onClick={() => handlers.onMove(block.id, -1)} title={strings.moveUp} />
          <TinyButton
            label="↓"
            disabled={location.index >= containerSize - 1}
            onClick={() => handlers.onMove(block.id, 1)}
            title={strings.moveDown}
          />
          <TinyButton label={strings.duplicateBlock} onClick={() => handlers.onDuplicate(block.id)} />
          <TinyButton label={strings.removeBlock} onClick={() => handlers.onRemove(block.id)} />
        </div>

        {/* ย้ายข้ามภาชนะ (ระดับหน้า ↔ คอลัมน์) — ทางเลือกที่ไม่ต้องลาก (ใช้เมาส์/คีย์บอร์ดก็ได้) */}
        {rows.length === 0 ? null : (
          /* รอบที่ 236: เป็น "อุปกรณ์ย่อย" ของแถวเหมือนปุ่ม ⇒ ต้องไม่ทะลุไปเลือกบล็อก (ไม่งั้นกดเลือกปลายทางแล้วจอเลื่อนตาม) */
          <label className="text-fg-muted flex items-center gap-1 text-[11px]" onClick={(event) => event.stopPropagation()}>
            <span className="shrink-0">{strings.moveToLabel}</span>
            <select
              value=""
              onChange={(event) => {
                const target = event.target.value;
                if (target === "") return;
                handlers.onMoveTo(block.id, moveTargetKeyOf(target));
              }}
              className="border-line bg-surface text-fg focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-1 py-0.5 text-[11px] focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">—</option>
              {moveTargets.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </li>
  );
}

function TinyButton({
  label,
  onClick,
  disabled = false,
  title,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function BlockLayerList({
  document,
  selectedId,
  strings,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onMoveTo,
}: {
  readonly document: BlockDocument;
  readonly selectedId: string;
  readonly strings: Messages["admin"];
  readonly onSelect: (blockId: string) => void;
  readonly onMove: (blockId: string, delta: -1 | 1) => void;
  readonly onDuplicate: (blockId: string) => void;
  readonly onRemove: (blockId: string) => void;
  readonly onMoveTo: (blockId: string, target: BlockLocation) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  const rows = document.blocks.filter((block): block is RowBlock => block.type === "row");
  const handlers: LayerHandlers = { strings, selectedId, onSelect, onMove, onDuplicate, onRemove, onMoveTo, rows };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted text-xs">{strings.dragHint}</p>

      <ol className="flex flex-col gap-1">
        {document.blocks.map((block, index) => (
          <li key={block.id} className="flex flex-col gap-1">
            <ol className="flex flex-col gap-1">
              <LayerItem
                block={block}
                label={fillTemplate(strings.blockNumber, { n: index + 1 })}
                location={{ rowId: null, columnId: null, index }}
                containerSize={document.blocks.length}
                handlers={handlers}
                dragging={dragging}
                setDragging={setDragging}
                dropKey={dropKey}
                setDropKey={setDropKey}
              />
            </ol>

            {/* คอลัมน์ของแถว + บล็อกลูก (ซ้อนได้ 1 ชั้น) */}
            {block.type === "row" ? (
              <div className="border-line ml-3 flex flex-col gap-1 border-l pl-2">
                {block.columns.map((column, columnIndex) => {
                  const columnDropKey = dropKeyOf({ rowId: block.id, columnId: column.id, index: 0 });
                  const empty = column.blocks.length === 0;
                  return (
                    <div
                      key={column.id}
                      onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes(DRAG_BLOCK_MIME)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setDropKey(columnDropKey);
                      }}
                      onDrop={(event) => {
                        const moving = event.dataTransfer.getData(DRAG_BLOCK_MIME);
                        if (moving === "") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onMoveTo(moving, { rowId: block.id, columnId: column.id, index: column.blocks.length });
                        setDragging(null);
                        setDropKey(null);
                      }}
                      className={`flex flex-col gap-1 rounded-lg border border-dashed p-1.5 ${
                        dropKey === columnDropKey && dragging !== null ? "border-brand-red" : "border-line"
                      }`}
                    >
                      <p className="text-fg-muted text-[11px] font-semibold">
                        {fillTemplate(strings.columnLabel, { n: columnIndex + 1 })} ·{" "}
                        {STYLE_CHOICES.columnWidth.find((entry) => entry.value === column.width)?.label ?? column.width}
                      </p>

                      {empty ? <p className="text-fg-muted text-[11px]">{strings.columnEmpty}</p> : null}

                      <ol className="flex flex-col gap-1">
                        {column.blocks.map((child, childIndex) => (
                          <LayerItem
                            key={child.id}
                            block={child}
                            label={`${fillTemplate(strings.blockNumber, { n: childIndex + 1 })} · ${fillTemplate(strings.blockInColumn, { n: columnIndex + 1 })}`}
                            location={{ rowId: block.id, columnId: column.id, index: childIndex }}
                            containerSize={column.blocks.length}
                            handlers={handlers}
                            dragging={dragging}
                            setDragging={setDragging}
                            dropKey={dropKey}
                            setDropKey={setDropKey}
                          />
                        ))}
                      </ol>
                    </div>
                  );
                })}
                <p className="text-fg-muted text-[11px]">
                  {fillTemplate(strings.rowColumnsCount, { n: block.columns.length })} · {strings.rowHint}
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {document.blocks.length === 0 ? <p className="text-fg-muted text-xs">{strings.emptyPage}</p> : null}
    </div>
  );
}
