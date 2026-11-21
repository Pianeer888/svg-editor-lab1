import { SaxesParser, type SaxesTagNS } from 'saxes';

export interface OutlineNode {
  readonly name: string;
  readonly start: number;
  end: number;
  readonly selectionEnd: number;
  readonly children: OutlineNode[];
}

/** Parses only the XML structure needed by Outline; incomplete edits return no symbols. */
export class SvgOutlineParser {
  parse(source: string): OutlineNode[] {
    const parser = new SaxesParser({ xmlns: true });
    const roots: OutlineNode[] = [];
    const stack: OutlineNode[] = [];
    let tagStart = 0;
    let isSvg = false;

    parser.on('doctype', () => { throw new Error('DOCTYPE is not supported'); });
    parser.on('opentagstart', tag => {
      tagStart = parser.position - tag.name.length - 2;
    });
    parser.on('opentag', (tag: SaxesTagNS) => {
      if (stack.length === 0) isSvg = tag.local === 'svg';
      const id = tag.attributes.id?.value;
      const node: OutlineNode = {
        name: id ? `${tag.local}#${id}` : tag.local,
        start: tagStart,
        end: parser.position,
        selectionEnd: tagStart + tag.name.length + 1,
        children: [],
      };
      const parent = stack.at(-1);
      if (parent) parent.children.push(node);
      else roots.push(node);
      stack.push(node);
    });
    parser.on('closetag', () => {
      const node = stack.pop();
      if (node) node.end = parser.position;
    });
    parser.on('error', error => { throw error; });

    try {
      parser.write(source).close();
      return isSvg && roots.length === 1 ? roots : [];
    } catch {
      return [];
    }
  }
}
