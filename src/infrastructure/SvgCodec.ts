import { SaxesParser, type SaxesTagNS } from 'saxes';
import { SvgDocument } from '../model/SvgDocument.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { Group } from '../model/Group.js';
import { Text } from '../model/Text.js';
import type { Shape } from '../model/Shape.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type XmlNode = { name: string; attributes: Record<string, string>; children: XmlNode[]; text: string };

export class SvgCodec {
  static serialize(document: SvgDocument): string {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="${SVG_NAMESPACE}" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
    ];
    for (const child of document.children) this.writeShape(child, 1, lines);
    lines.push('</svg>');
    return `${lines.join('\n')}\n`;
  }

  static parse(xml: string): { document: SvgDocument; warnings: string[] } {
    let root: XmlNode | undefined;
    const stack: XmlNode[] = [];
    const parser = new SaxesParser({ xmlns: true });
    parser.on('doctype', () => { throw new Error('DOCTYPE is not supported'); });
    parser.on('processinginstruction', () => { throw new Error('processing instructions are not supported'); });
    parser.on('error', error => { throw error; });
    parser.on('opentag', (tag: SaxesTagNS) => {
      if (tag.uri !== SVG_NAMESPACE && tag.uri !== '') throw new Error(`unsupported SVG namespace: ${tag.uri}`);
      const attributes: Record<string, string> = {};
      for (const attribute of Object.values(tag.attributes)) {
        if (attribute.uri === 'http://www.w3.org/2000/xmlns/') continue;
        if (attribute.uri !== '') throw new Error(`unsupported SVG attribute: ${attribute.name}`);
        attributes[attribute.local] = attribute.value;
      }
      const node: XmlNode = { name: tag.local, attributes, children: [], text: '' };
      const parent = stack.at(-1);
      if (parent) parent.children.push(node);
      else if (root) throw new Error('multiple SVG roots');
      else root = node;
      stack.push(node);
    });
    parser.on('text', value => { const node = stack.at(-1); if (node) node.text += value; });
    parser.on('cdata', value => { const node = stack.at(-1); if (node) node.text += value; });
    parser.on('closetag', () => { stack.pop(); });
    parser.write(xml).close();
    if (!root || root.name !== 'svg') throw new Error('SVG root element required');
    if (root.text.trim()) throw new Error('unexpected text in <svg>');
    for (const name of Object.keys(root.attributes)) {
      if (!['width', 'height', 'viewBox'].includes(name)) throw new Error(`unsupported SVG attribute: ${name}`);
    }
    const viewBox = root.attributes.viewBox?.trim().split(/[\s,]+/).map(Number);
    if (viewBox && (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value)))) {
      throw new Error('invalid SVG viewBox');
    }
    const width = this.dimension(root.attributes.width, viewBox?.[2], 'width');
    const height = this.dimension(root.attributes.height, viewBox?.[3], 'height');
    if (viewBox && (viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== width || viewBox[3] !== height)) {
      throw new Error('unsupported SVG viewBox');
    }
    const document = new SvgDocument(width, height);
    const explicitIds = new Set<string>();
    const all = (function* walk(nodes: readonly XmlNode[]): IterableIterator<XmlNode> {
      for (const node of nodes) { yield node; yield* walk(node.children); }
    })(root.children);
    for (const node of all) {
      const id = node.attributes.id;
      if (id !== undefined && id !== '') {
        if (explicitIds.has(id)) throw new Error(`id already exists: ${id}`);
        explicitIds.add(id);
      }
    }
    const usedIds = new Set(explicitIds);
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    const add = (node: XmlNode, parentId?: string): void => {
      let id = node.attributes.id;
      if (!id) {
        let number = counters.get(node.name) ?? 0;
        do { number += 1; id = `${node.name}${number}`; } while (usedIds.has(id));
        counters.set(node.name, number);
        usedIds.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${node.name}>`);
      }
      const shape = ShapeFactory.fromSvg(node.name, id, node.attributes, node.text);
      if (!(shape instanceof Group) && node.children.length > 0) throw new Error(`unsupported nested content in <${node.name}>`);
      document.add(shape, parentId);
      for (const child of node.children) add(child, id);
    };
    for (const child of root.children) add(child);
    return { document, warnings };
  }

  private static writeShape(shape: Shape, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth);
    const attributes = [`id="${this.escape(shape.id)}"`];
    for (const [name, value] of Object.entries(shape.geometry())) {
      if (name !== 'text') attributes.push(`${name}="${this.escape(String(value))}"`);
    }
    if (shape.fill !== undefined) attributes.push(`fill="${this.escape(shape.fill)}"`);
    if (shape.stroke !== undefined) attributes.push(`stroke="${this.escape(shape.stroke)}"`);
    if (shape.strokeWidth !== undefined) attributes.push(`stroke-width="${shape.strokeWidth}"`);
    const start = `${indent}<${shape.type} ${attributes.join(' ')}`;
    if (shape instanceof Group) {
      if (shape.children.length === 0) lines.push(`${start}/>`);
      else {
        lines.push(`${start}>`);
        for (const child of shape.children) this.writeShape(child, depth + 1, lines);
        lines.push(`${indent}</g>`);
      }
    } else if (shape instanceof Text) {
      lines.push(`${start}>${this.escape(String(shape.geometry().text))}</text>`);
    } else lines.push(`${start}/>`);
  }

  private static dimension(raw: string | undefined, fallback: number | undefined, name: string): number {
    if (raw === undefined) {
      if (fallback === undefined) throw new Error(`missing SVG attribute: ${name}`);
      return fallback;
    }
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/.test(raw.trim())) throw new Error(`invalid SVG ${name}: ${raw}`);
    const value = Number(raw.trim().replace(/px$/, ''));
    if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid SVG ${name}: ${raw}`);
    return value;
  }

  private static escape(value: string): string {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)) {
      throw new Error('invalid XML character');
    }
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
