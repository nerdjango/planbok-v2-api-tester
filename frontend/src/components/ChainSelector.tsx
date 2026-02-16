'use client';

import { CHAINS, ChainInfo } from '@/lib/chains';

interface ChainSelectorProps {
  selectedChains: string[];
  onSelectionChange: (chains: string[]) => void;
  multiple?: boolean;
  showAll?: boolean;
}

export function ChainSelector({ 
  selectedChains, 
  onSelectionChange, 
  multiple = true,
  showAll = true 
}: ChainSelectorProps) {
  const toggleChain = (chainId: string) => {
    if (multiple) {
      if (selectedChains.includes(chainId)) {
        onSelectionChange(selectedChains.filter(c => c !== chainId));
      } else {
        onSelectionChange([...selectedChains, chainId]);
      }
    } else {
      onSelectionChange([chainId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(CHAINS.map(c => c.id));
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-3">
      {showAll && multiple && (
        <div className="flex gap-2 text-sm">
          <button
            onClick={selectAll}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Select All
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={selectNone}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Select None
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CHAINS.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            selected={selectedChains.includes(chain.id)}
            onClick={() => toggleChain(chain.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ChainCardProps {
  chain: ChainInfo;
  selected: boolean;
  onClick: () => void;
}

function ChainCard({ chain, selected, onClick }: ChainCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border-2 transition-all duration-200
        ${selected 
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
        }
      `}
    >
      <div className="flex flex-col items-center gap-2">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${chain.color}20` }}
        >
          {chain.icon}
        </div>
        <div className="text-center">
          <div className="font-medium text-sm text-white truncate max-w-full">
            {chain.name}
          </div>
          <div className="text-xs text-gray-400">{chain.symbol}</div>
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}
