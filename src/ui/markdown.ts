/**
 * Mini-rendu Markdown -> HTML, suffisant pour afficher les README du projet
 * dans l'interface (titres, gras, code en ligne, blocs de code, tableaux,
 * listes, citations, liens). Aucune dépendance externe.
 *
 * Le contenu provient de fichiers du dépôt (de confiance) ; on échappe tout de
 * même le HTML pour que des symboles comme « <- », « <= » ou « | » s'affichent
 * littéralement au lieu d'être interprétés comme des balises.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Code en ligne (`…`) puis gras (**…**), sur du texte déjà échappé. */
function spans(s: string): string {
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

/**
 * Formatage en ligne : liens d'abord (leur libellé peut contenir du `code`),
 * puis code et gras sur le reste. Tout est échappé au préalable.
 */
function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const inner = spans(label);
    if (/^https?:\/\//.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener">${inner}</a>`;
    }
    // Fichier .algo : lien de téléchargement (géré côté app via data-download).
    if (/\.algo$/i.test(url)) {
      return `<a href="#" class="doc-download" data-download="${url}">⬇ ${inner}</a>`;
    }
    // Autre lien relatif (ex. .md) : non navigable ici, on garde le libellé.
    return `<span class="doc-link">${inner}</span>`;
  });
  return spans(s);
}

/** Découpe une ligne de tableau en cellules (gère les « \| » échappés). */
function splitRow(row: string): string[] {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

const isTableSep = (line: string): boolean =>
  /^[\s|:-]+$/.test(line) && line.includes("|") && line.includes("-");

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Bloc de code ``` … ```
    if (/^```/.test(line.trim())) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++; // saute la clôture
      html.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>");
      continue;
    }

    // Tableau : ligne avec « | » suivie d'une ligne séparatrice
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i++]));
      }
      let t = "<table><thead><tr>";
      for (const h of header) t += "<th>" + inline(h) + "</th>";
      t += "</tr></thead><tbody>";
      for (const r of rows) {
        t += "<tr>";
        for (let c = 0; c < header.length; c++) t += "<td>" + inline(r[c] ?? "") + "</td>";
        t += "</tr>";
      }
      html.push(t + "</tbody></table>");
      continue;
    }

    // Titre #..######
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      html.push(`<h${level}>` + inline(h[2]) + `</h${level}>`);
      i++;
      continue;
    }

    // Citation > … (multi-lignes)
    if (/^\s*>/.test(line)) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push("<blockquote>" + inline(buf.join(" ")) + "</blockquote>");
      continue;
    }

    // Élément de liste
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push("<li>" + inline(li[1]) + "</li>");
      i++;
      continue;
    }

    // Règle horizontale
    if (/^\s*---+\s*$/.test(line)) {
      closeList();
      html.push("<hr>");
      i++;
      continue;
    }

    // Ligne vide
    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    // Paragraphe (regroupe les lignes consécutives « ordinaires »)
    closeList();
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*---+\s*$/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      buf.push(lines[i++]);
    }
    html.push("<p>" + inline(buf.join(" ")) + "</p>");
  }

  closeList();
  return html.join("\n");
}
