import React, { useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

export default function ReasoningDrawer({ reasoning }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!reasoning) return null;

  return (
    <div className="reasoning-box">
      <div className="reasoning-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BrainCircuit size={15} />
          <span>Analytical Methodology & Reasoning Chain</span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {isOpen && (
        <div className="reasoning-content">
          {reasoning}
        </div>
      )}
    </div>
  );
}
