import { Fragment, memo, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors, type ThemeColors } from '@/theme';

/**
 * A small Markdown renderer for chat replies: headings, lists, quotes, code
 * blocks, bold, italic, inline code and links. Anything else shows as plain text.
 */

type Block =
  | { type: 'code'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'bullet'; marker: string; indent: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'paragraph'; text: string };

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
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      endParagraph();
      const code: string[] = [];
      // An unclosed fence (still streaming) runs to the end of the text.
      while (++i < lines.length && !lines[i].trimStart().startsWith(fence[1])) code.push(lines[i]);
      blocks.push({ type: 'code', text: code.join('\n') });
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
            return (
              <View key={i} style={[styles.codeBlock, { backgroundColor: colors.surfaceStrong }]}>
                <Text selectable style={[styles.code, { color }]}>
                  {block.text}
                </Text>
              </View>
            );
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

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  text: { fontSize: 16, lineHeight: 23 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  inlineCode: { fontFamily: mono, fontSize: 14 },
  codeBlock: { borderRadius: Radius.sm, padding: Spacing.md },
  code: { fontFamily: mono, fontSize: 13, lineHeight: 19 },
  bulletRow: { flexDirection: 'row', gap: Spacing.sm },
  marker: { minWidth: 14 },
  flex: { flex: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.md },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
});
