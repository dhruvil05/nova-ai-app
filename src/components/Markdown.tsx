import * as Clipboard from 'expo-clipboard';
import { Fragment, memo, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors, type ThemeColors } from '@/theme';

import { Icon } from './Icon';

/**
 * A small Markdown renderer for chat replies: headings, lists, quotes, tables,
 * code blocks, bold, italic, inline code and links. Anything else shows as plain text.
 */

type Align = 'left' | 'center' | 'right';

type Block =
  | { type: 'code'; text: string; language: string }
  | { type: 'table'; header: string[]; align: Align[]; rows: string[][] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'bullet'; marker: string; indent: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'paragraph'; text: string };

/** The line under a table's header, such as |---|:---:|. */
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Splits "| a | b \| c |" into cells, keeping escaped pipes. */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .replace(/\\\|/g, '\u0000')
    .split('|')
    .map((cell) => cell.replace(/\u0000/g, '|').trim());
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split('\n');
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+#.-]*)/);
    if (fence) {
      endParagraph();
      const code: string[] = [];
      // An unclosed fence (still streaming) runs to the end of the text.
      while (++i < lines.length && !lines[i].trimStart().startsWith(fence[1])) code.push(lines[i]);
      blocks.push({ type: 'code', text: code.join('\n'), language: fence[2] });
      continue;
    }
    // A table starts with a header row followed by a divider row.
    // The divider needs a pipe too, so "a | b" above a plain "---" rule stays text.
    const divider = lines[i + 1] ?? '';
    if (line.includes('|') && divider.includes('|') && divider.includes('-') && TABLE_DIVIDER.test(divider)) {
      endParagraph();
      const header = tableCells(line);
      const align = tableCells(lines[i + 1]).map((cell): Align =>
        cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left'
      );
      const rows: string[][] = [];
      i += 1;
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) {
        const cells = tableCells(lines[++i]);
        rows.push(header.map((_, c) => cells[c] ?? ''));
      }
      blocks.push({ type: 'table', header, align: header.map((_, c) => align[c] ?? 'left'), rows });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (heading) {
      endParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      endParagraph();
      blocks.push({ type: 'rule' });
    } else if (bullet) {
      endParagraph();
      const marker = /\d/.test(bullet[2]) ? bullet[2].replace(')', '.') : '•';
      blocks.push({ type: 'bullet', marker, indent: Math.floor(bullet[1].length / 2), text: bullet[3] });
    } else if (quote) {
      endParagraph();
      blocks.push({ type: 'quote', text: quote[1] });
    } else if (!line.trim()) {
      endParagraph();
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string, colors: ThemeColors): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <Text key={i} style={styles.bold}>
          {renderInline(part.slice(2, -2), colors)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <Text key={i} style={[styles.inlineCode, { backgroundColor: colors.surfaceStrong }]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return (
        <Text key={i} style={{ color: colors.accent }} onPress={() => Linking.openURL(link[2]).catch(() => {})}>
          {link[1]}
        </Text>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      if (part.length > 2) {
        return (
          <Text key={i} style={styles.italic}>
            {part.slice(1, -1)}
          </Text>
        );
      }
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export const Markdown = memo(function Markdown({ text, color }: { text: string; color: string }) {
  const colors = useColors();
  const blocks = parseBlocks(text);
  const base = [styles.text, { color }];

  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={i} text={block.text} language={block.language} color={color} />;
          case 'table':
            return <Table key={i} block={block} color={color} />;
          case 'heading':
            return (
              <Text key={i} selectable style={[base, styles.bold, { fontSize: block.level <= 2 ? 19 : 17 }]}>
                {renderInline(block.text, colors)}
              </Text>
            );
          case 'bullet':
            return (
              <View key={i} style={[styles.bulletRow, { paddingLeft: block.indent * 16 }]}>
                <Text style={[base, styles.marker]}>{block.marker}</Text>
                <Text selectable style={[base, styles.flex]}>
                  {renderInline(block.text, colors)}
                </Text>
              </View>
            );
          case 'quote':
            return (
              <Text key={i} selectable style={[base, styles.quote, { borderLeftColor: colors.border, color: colors.textSecondary }]}>
                {renderInline(block.text, colors)}
              </Text>
            );
          case 'rule':
            return <View key={i} style={[styles.rule, { backgroundColor: colors.border }]} />;
          default:
            return (
              <Text key={i} selectable style={base}>
                {renderInline(block.text, colors)}
              </Text>
            );
        }
      })}
    </View>
  );
});

/** A code block with its language and a Copy button. Long lines scroll sideways instead of wrapping. */
function CodeBlock({ text, language, color }: { text: string; language: string; color: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.codeBlock, { backgroundColor: colors.surfaceStrong }]}>
      <View style={[styles.codeHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.codeLanguage, { color: colors.textSecondary }]}>{language || 'code'}</Text>
        <Pressable onPress={copy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy code" style={styles.codeCopy}>
          <Icon name={copied ? 'check' : 'copy'} size={14} color={colors.textSecondary} />
          <Text style={[styles.codeLanguage, { color: colors.textSecondary }]}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeScroll}>
        <Text selectable style={[styles.code, { color }]}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * A table with columns sized to their longest cell, up to a limit, so short
 * tables fit and wide ones scroll sideways.
 */
function Table({ block, color }: { block: Extract<Block, { type: 'table' }>; color: string }) {
  const colors = useColors();
  const rows = [block.header, ...block.rows];
  const widths = block.header.map((_, c) => {
    const longest = Math.max(...rows.map((row) => row[c].length));
    return Math.min(260, Math.max(72, longest * 8 + Spacing.md * 2));
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.table, { borderColor: colors.border }]}>
        {rows.map((row, r) => (
          <View
            key={r}
            style={[
              styles.tableRow,
              r === 0 ? { backgroundColor: colors.surface } : { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}>
            {row.map((cell, c) => (
              <View
                key={c}
                style={[styles.tableCell, { width: widths[c] }, c > 0 && { borderLeftColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth }]}>
                <Text selectable style={[styles.tableText, r === 0 && styles.bold, { color, textAlign: block.align[c] }]}>
                  {renderInline(cell, colors)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  text: { fontSize: 16, lineHeight: 23 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  inlineCode: { fontFamily: mono, fontSize: 14 },
  codeBlock: { borderRadius: Radius.sm, overflow: 'hidden' },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeLanguage: { fontSize: 12, fontWeight: '500' },
  codeCopy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeScroll: { padding: Spacing.md },
  code: { fontFamily: mono, fontSize: 13, lineHeight: 19 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.sm, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  tableCell: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  tableText: { fontSize: 14, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', gap: Spacing.sm },
  marker: { minWidth: 14 },
  flex: { flex: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.md },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
});
