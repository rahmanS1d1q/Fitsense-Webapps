"use client";

import React from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import HRMonitor, { HRData } from "./HRMonitor";

export interface MemberItem {
  id: string;
  name: string;
  hrData: HRData | null;
}

interface MemberListProps {
  members: MemberItem[];
  height?: number;
  itemHeight?: number;
}

const MAX_VISIBLE = 100;

/**
 * Virtualized member list using react-window.
 * Only renders visible items — max 100 members in DOM at once.
 * Requirements: 13.8, 13.9
 */
export default function MemberList({
  members,
  height = 600,
  itemHeight = 64,
}: MemberListProps) {
  const visible = members.slice(0, MAX_VISIBLE);
  const hidden = members.length - visible.length;

  const Row = ({ index, style }: ListChildComponentProps) => {
    const member = visible[index];
    return (
      <div style={{ ...style, padding: "4px 0" }}>
        <HRMonitor
          memberId={member.id}
          memberName={member.name}
          hrData={member.hrData}
        />
      </div>
    );
  };

  return (
    <div>
      {hidden > 0 && (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
          Menampilkan 100 dari {members.length} member. Gunakan pencarian untuk
          menemukan member lain.
        </p>
      )}
      <FixedSizeList
        height={height}
        itemCount={visible.length}
        itemSize={itemHeight}
        width="100%"
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
