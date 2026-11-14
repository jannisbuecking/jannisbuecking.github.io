"use strict";

async function loadContributions() {
  const calendar = document.getElementById("contribution-calendar");
  const summary = document.getElementById("contribution-summary");
  const tooltip = document.getElementById("contribution-tooltip");
  const dateFormat = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
  const parseDate = (date) => new Date(`${date}T00:00:00Z`);
  const hideTooltip = () => { tooltip.hidden = true; };

  try {
    const response = await fetch("data/contributions.json");
    if (!response.ok) throw new Error("Contribution data unavailable");
    const data = await response.json();
    if (!Array.isArray(data.days) || !data.days.length) throw new Error("Empty contribution calendar");

    const inner = document.createElement("div");
    inner.className = "calendar-inner";
    const months = document.createElement("div");
    months.className = "calendar-months";
    months.setAttribute("aria-hidden", "true");
    const weekdays = document.createElement("div");
    weekdays.className = "calendar-weekdays";
    weekdays.setAttribute("aria-hidden", "true");
    for (const [day, row] of [["Mon", 2], ["Wed", 4], ["Fri", 6]]) {
      const label = document.createElement("span");
      label.textContent = day;
      label.style.gridRow = row;
      weekdays.append(label);
    }

    const days = document.createElement("div");
    days.className = "calendar-days";
    days.setAttribute("role", "group");
    days.setAttribute("aria-label", "Daily GitHub contributions");
    days.setAttribute("aria-describedby", "calendar-help");
    const offset = parseDate(data.days[0].date).getUTCDay();
    const columns = Math.ceil((data.days.length + offset) / 7);
    months.style.gridTemplateColumns = days.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    let lastMonth = -1;

    data.days.forEach((day, index) => {
      const date = parseDate(day.date);
      const column = Math.floor((index + offset) / 7) + 1;
      if (date.getUTCMonth() !== lastMonth) {
        if (column <= columns - 1 && (index !== 0 || date.getUTCDate() <= 24)) {
          const label = document.createElement("span");
          label.textContent = monthFormat.format(date);
          label.style.gridColumn = `${column} / span 2`;
          label.style.gridRow = "1";
          months.append(label);
        }
        lastMonth = date.getUTCMonth();
      }

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `contribution-day level-${day.level}`;
      cell.style.gridColumn = column;
      cell.style.gridRow = date.getUTCDay() + 1;
      const label = `${day.count.toLocaleString()} ${day.count === 1 ? "contribution" : "contributions"} on ${dateFormat.format(date)}`;
      cell.setAttribute("aria-label", label);
      cell.tabIndex = index === data.days.length - 1 ? 0 : -1;
      const showTooltip = () => {
        tooltip.textContent = label;
        tooltip.hidden = false;
        const bounds = cell.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        tooltip.style.left = `${Math.max(12, Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 12))}px`;
        const top = bounds.top - tooltip.offsetHeight - 8;
        tooltip.style.top = `${top >= 8 ? top : bounds.bottom + 8}px`;
      };
      cell.addEventListener("mouseenter", showTooltip);
      cell.addEventListener("mouseleave", hideTooltip);
      cell.addEventListener("focus", () => {
        days.querySelector('[tabindex="0"]')?.setAttribute("tabindex", "-1");
        cell.tabIndex = 0;
        showTooltip();
      });
      cell.addEventListener("blur", hideTooltip);
      cell.addEventListener("click", showTooltip);
      cell.addEventListener("keydown", (event) => {
        const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
        if (step) {
          event.preventDefault();
          days.children[Math.max(0, Math.min(data.days.length - 1, index + step))].focus();
        } else if (event.key === "Escape") hideTooltip();
      });
      days.append(cell);
    });

    inner.append(months, weekdays, days);
    calendar.replaceChildren(inner);
    calendar.addEventListener("scroll", hideTooltip);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, { passive: true });
    summary.textContent = `${data.total.toLocaleString()} contributions in the last year`;
    const updated = dateFormat.format(new Date(data.updatedAt));
    document.getElementById("contribution-updated").textContent = `Updated ${updated} · refreshed daily`;
  } catch (error) {
    const message = document.createElement("p");
    message.className = "calendar-message";
    message.textContent = "The calendar is unavailable right now. ";
    const link = document.createElement("a");
    link.href = "https://github.com/jannisbuecking";
    link.textContent = "View contributions on GitHub ↗";
    message.append(link);
    calendar.replaceChildren(message);
  } finally {
    calendar.setAttribute("aria-busy", "false");
  }
}

loadContributions();
