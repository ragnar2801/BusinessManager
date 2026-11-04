import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from './app';
import { BankProvider } from './bank/store';
import { BankHistory, BankHome, BankSetup } from './screens/Bank';
import { Admin } from './screens/Admin';
import { Fix } from './screens/Fix';
import { Game } from './screens/Game';
import { Ledger } from './screens/Ledger';
import { Properties } from './screens/Properties';
import { Setup } from './screens/Setup';
import { Trade } from './screens/Trade';
import './styles.css';

function Router() {
  const { view, game } = useApp();
  if (view.name === 'bank') return <BankHome />;
  if (view.name === 'bankSetup') return <BankSetup />;
  if (view.name === 'bankHistory') return <BankHistory />;
  // Game-only screens fall back to setup when there is no game.
  if (!game && view.name !== 'admin') return <Setup />;
  switch (view.name) {
    case 'home':
      return <Setup />;
    case 'admin':
      return <Admin boardId={view.boardId} />;
    case 'ledger':
      return <Ledger />;
    case 'properties':
      return <Properties key={view.playerId} playerId={view.playerId} />;
    case 'trade':
      return <Trade />;
    case 'fix':
      return <Fix />;
    default:
      return <Game />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <BankProvider>
        <Router />
      </BankProvider>
    </AppProvider>
  </StrictMode>,
);
