import { REFRESH_OPTIONS } from "../../lib/constants";
import { useStockSearch } from "../../hooks/useStockSearch";
import { buildLocalBackup, sanitizeBackup } from "../../lib/utils";

function SettingSection({ id, icon, title, description, badge, children, className = "" }) {
  return (
    <section id={id} className={`settingsSection ${className}`}>
      <div className="settingsSectionHeader">
        <div className="settingsSectionTitle">
          <span className="settingsIcon" aria-hidden="true">{icon}</span>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
        {badge && <span className="settingsBadge">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

export function ConfigPanel({
  open, screenName, setScreenName, portfolioView, setPortfolioView,
  notificationsEnabled, enableNotifications, setNotificationsEnabled,
  soundEnabled, setSoundEnabled, onSave, onCancel, onClose,
  input, runSearch, suggestions, addTicker, tickers, order, removeTicker,
  activeWatchlist, setActiveWatchlist, watchlists, createWatchlist, deleteWatchlist,
  refreshSeconds, setRefreshSeconds, setSecondsLeft,
  portfolio, updateHolding, removeHolding, addHolding,
  alerts, alertTicker, setAlertTicker, alertDirection, setAlertDirection,
  alertPrice, setAlertPrice, addAlert, removeAlert,
  setTickers, setOrder, setAlerts, setError, setPortfolio,
  setWatchlists
}) {
  const holdingSearch = useStockSearch();

  if (!open) return null;

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildLocalBackup(
      tickers, order, alerts, screenName, refreshSeconds, portfolio, portfolioView,
      watchlists, notificationsEnabled, soundEnabled, activeWatchlist
    ), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `market-watch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 2_000_000) throw new Error("Backup file is too large.");

      const raw = JSON.parse(await file.text());
      const safe = sanitizeBackup(raw);

      // Apply every exported workspace setting. React state is the source of
      // truth; the persistence hook will write the imported state to localStorage.
      setTickers(safe.watchlist);
      setOrder(safe.order);
      setAlerts(safe.alerts);
      setScreenName(safe.screenName);
      setRefreshSeconds(safe.refreshSeconds);
      setPortfolio(safe.portfolio);
      setPortfolioView(safe.portfolioView);
      setWatchlists(safe.watchlists);
      setActiveWatchlist(safe.activeWatchlist);
      setNotificationsEnabled(safe.notificationsEnabled);
      setSoundEnabled(safe.soundEnabled);
      setError("");

      // Import is a deliberate state replacement, so do not allow the
      // existing Settings "Cancel" snapshot to immediately undo it.
      onSave?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not import that backup file.");
    } finally {
      // Allows importing the same file again after editing it.
      e.target.value = "";
    }
  };

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={e => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <section className="modal settingsShell" aria-label="Market Watch settings">
      <div className="modalHeader settingsTopbar">
        <div className="settingsHeaderIdentity">
          <div className="settingsHeaderMark" aria-hidden="true">⚙</div>
          <div>
            <span className="settingsEyebrow">WORKSPACE SETTINGS</span>
            <h2 id="settings-title">Configure Market Watch</h2>
          </div>
        </div>
        <div className="settingsHeaderRight">
          <span className="settingsLocalState"><span aria-hidden="true">●</span> Saved locally</span>
          <button className="closeModal" onClick={onClose} aria-label="Close configuration">×</button>
        </div>
      </div>
      <div className="settingsHero">
        <div className="settingsHeroCopy">
          <strong>Make Market Watch work your way.</strong>
          <p>Personalize your workspace, data refresh, watchlists, portfolio and alerts.</p>
        </div>
        <div className="settingsHeroActions">
          <button className="secondaryBtn" onClick={exportBackup}>Export</button>
          <label className="secondaryBtn fileBtn">
            Import
            <input type="file" accept="application/json,.json" hidden onChange={importBackup} />
          </label>
        </div>
      </div>

      <div className="settingsWorkspace">
        <nav className="settingsNav" aria-label="Settings sections">
          <span className="settingsNavLabel">SETTINGS</span>
          <a href="#settings-workspace"><span>✦</span><b>Workspace</b></a>
          <a href="#settings-refresh"><span>↻</span><b>Refresh</b></a>
          <a href="#settings-watchlist"><span>＋</span><b>Watchlist</b></a>
          <a href="#settings-portfolio"><span>◎</span><b>Portfolio</b></a>
          <a href="#settings-alerts"><span>⌁</span><b>Price alerts</b></a>
          <div className="settingsNavHint">Changes are saved to this browser only.</div>
        </nav>
        <div className="settingsGrid">
        <SettingSection id="settings-workspace" icon="✦" title="Workspace" description="Give this workspace a name and choose your personal market settings." badge="PERSONAL">
          <div className="workspaceEditor">
            <div className="workspaceNameField">
              <label htmlFor="workspace-name">Workspace name</label>
              <input id="workspace-name" value={screenName} maxLength={48}
                onChange={e => setScreenName(e.target.value)}
                placeholder="e.g. Prasad's Portfolio" />
              <span>{screenName.length}/48</span>
            </div>
            <button className="secondaryBtn" onClick={() => setScreenName("Market Watch")}>Reset</button>
          </div>
          <div className="settingsChoices">
            <label className={`choiceCard ${portfolioView ? "selected" : ""}`}>
              <input type="checkbox" checked={portfolioView} onChange={e => setPortfolioView(e.target.checked)} />
              <span><b>Portfolio panel</b><small>Show holdings, value and profit/loss beside your watchlist.</small></span>
            </label>
            <label className={`choiceCard ${notificationsEnabled ? "selected" : ""}`}>
              <input type="checkbox" checked={notificationsEnabled} onChange={e => e.target.checked ? enableNotifications() : setNotificationsEnabled(false)} />
              <span><b>Browser notifications</b><small>Get a notification when a price alert triggers.</small></span>
            </label>
            <label className={`choiceCard ${soundEnabled ? "selected" : ""}`}>
              <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
              <span><b>Alert sound</b><small>Play a short audible alert when a price rule triggers.</small></span>
            </label>
          </div>
        </SettingSection>

        <SettingSection id="settings-refresh" icon="↻" title="Refresh" description="How often the workspace requests fresh market data." badge={`${refreshSeconds}s`}>
          <div className="refreshPicker">
            {REFRESH_OPTIONS.map(value => (
              <button key={value} className={refreshSeconds === value ? "active" : ""} onClick={() => {
                setRefreshSeconds(value);
                setSecondsLeft(value);
              }}>
                <b>{value < 60 ? `${value}s` : value === 60 ? "1m" : value === 90 ? "1m 30s" : value === 120 ? "2m" : "5m"}</b>
                <span>{value === 15 ? "Fast" : value === 30 ? "Recommended" : value === 60 ? "Balanced" : value === 300 ? "Low traffic" : "Lower traffic"}</span>
              </button>
            ))}
          </div>
        </SettingSection>

        <SettingSection id="settings-watchlist" icon="＋" title="Watchlist" description="Add stocks and organize them into local lists." badge={`${tickers.length} STOCKS`} className="settingsWide">
          <div className="searchAdd settingsSearch">
            <div className="autocomplete">
              <input value={input} onChange={e => runSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTicker()}
                placeholder="Search company or symbol — NVDA, Tata, M&M…" aria-label="Search stocks" />
              {suggestions.length > 0 && <div className="suggestions">
                {suggestions.map(s => <button key={`${s.symbol}-${s.exchange}`} onClick={() => addTicker(s.symbol, true)}>
                  <b>{s.symbol}</b><span>{s.name}</span><small>{s.exchange}</small>
                </button>)}
              </div>}
            </div>
            <button className="primaryBtn" onClick={() => addTicker()}>Add stock</button>
          </div>

          <div className="watchlistToolbar">
            <div className="watchlistTabs">
              <button className={activeWatchlist === "All Stocks" ? "active" : ""} onClick={() => setActiveWatchlist("All Stocks")}>All Stocks</button>
              {Object.keys(watchlists).map(name => (
                <button key={name} className={activeWatchlist === name ? "active" : ""} onClick={() => setActiveWatchlist(name)}>{name}</button>
              ))}
              <button className="newWatchlistBtn" onClick={createWatchlist}>＋ New list</button>
            </div>
            {activeWatchlist !== "All Stocks" && (
              <button className="dangerBtn" onClick={() => deleteWatchlist(activeWatchlist)}>Delete list</button>
            )}
          </div>

          <div className="settingsStockList">
            {order.filter(s => tickers.includes(s)).map(t => (
              <div className="settingsStockRow" key={t}>
                <span className="stockSymbol">{t}</span>
                <span className="stockMeta">{watchlists[activeWatchlist]?.includes(t) ? "In current list" : "All Stocks"}</span>
                <button className="iconBtn" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`}>×</button>
              </div>
            ))}
          </div>
          <p className="settingsHint">Drag cards on the main screen to change their order. Watchlists and symbols are stored only in this browser.</p>
        </SettingSection>

        <SettingSection id="settings-portfolio" icon="◎" title="Portfolio" description="Track holdings independently of your watchlist and group them by stock exchange." badge={portfolioView ? "VISIBLE" : "HIDDEN"} className="settingsWide">
          <div className="holdingSearch">
            <div className="autocomplete">
              <input
                value={holdingSearch.input}
                onChange={e => holdingSearch.runSearch(e.target.value)}
                onKeyDown={async e => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  await addHolding(holdingSearch.input, false);
                  holdingSearch.clearSearch();
                }}
                placeholder="Search any stock — NVDA, RELIANCE.NS, M&M.NS…"
                aria-label="Search and add portfolio holding"
              />
              {holdingSearch.suggestions.length > 0 && (
                <div className="suggestions">
                  {holdingSearch.suggestions.map(s => (
                    <button
                      key={`${s.symbol}-${s.exchange}`}
                      onClick={async () => {
                        await addHolding(s.symbol, true);
                        holdingSearch.clearSearch();
                      }}
                    >
                      <b>{s.symbol}</b><span>{s.name}</span><small>{s.exchange}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="primaryBtn"
              onClick={async () => {
                await addHolding(holdingSearch.input, false);
                holdingSearch.clearSearch();
              }}
            >
              ＋ Add holding
            </button>
          </div>

          <div className="portfolioEditor">
            {portfolio.map(h => (
              <div className="holdingRow" key={h.id}>
                <div className="holdingSymbolReadOnly">
                  <b>{h.symbol}</b>
                  <small>Independent of watchlist</small>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={h.shares === "" ? "" : h.shares}
                  onChange={e => updateHolding(h.id, "shares", e.target.value)}
                  placeholder="Shares"
                  aria-label={`${h.symbol} shares`}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={h.buyPrice === "" ? "" : h.buyPrice}
                  onChange={e => updateHolding(h.id, "buyPrice", e.target.value)}
                  placeholder="Buy price"
                  aria-label={`${h.symbol} buy price`}
                />
                <button className="iconBtn" onClick={() => removeHolding(h.id)} aria-label={`Remove ${h.symbol} holding`}>×</button>
              </div>
            ))}
            {!portfolio.length && (
              <div className="portfolioEmpty">No holdings configured. Add any supported stock above, even if it is not in your watchlist.</div>
            )}
          </div>
        </SettingSection>

        <SettingSection id="settings-alerts" icon="⌁" title="Price alerts" description="Set a price threshold directly from settings. Card-level alerts are also available." badge={`${alerts.length} ACTIVE`}>
          <div className="alertForm">
            <select value={alertTicker} onChange={e => setAlertTicker(e.target.value)}>{tickers.map(t => <option key={t}>{t}</option>)}</select>
            <select value={alertDirection} onChange={e => setAlertDirection(e.target.value)}>
              <option value="above">Crosses above</option><option value="below">Crosses below</option>
            </select>
            <input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)} placeholder="Target price" step="any" />
            <button className="primaryBtn" onClick={addAlert}>Add alert</button>
          </div>
          <div className="alertList">
            {alerts.length ? alerts.map(a => (
              <div className="alertItem" key={a.id}>
                <span><b>{a.symbol}</b> {a.kind === "trailing" ? `${a.direction === "below" ? "↓" : "↑"} ${a.percent}% trailing` : `${a.direction === "above" ? "≥" : "≤"} ${a.price}`}</span>
                <button onClick={() => removeAlert(a.id)}>Remove</button>
              </div>
            )) : <span className="settingsHint">No alerts configured yet.</span>}
          </div>
        </SettingSection>
      </div>
      </div>
      <div className="modalFooter">
        <button className="secondaryBtn" onClick={onCancel}>Cancel</button>
        <button className="primaryBtn" onClick={onSave}>Save changes</button>
      </div>
    </section>
    </div>
  );
}
