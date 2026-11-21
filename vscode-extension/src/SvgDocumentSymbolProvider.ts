import * as vscode from 'vscode';
import { SvgOutlineParser, type OutlineNode } from './SvgOutlineParser';

/** Adapts parsed SVG nodes to VS Code's native document symbols. */
export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly parser = new SvgOutlineParser()) {}

  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    return this.parser.parse(document.getText()).map(node => this.toSymbol(document, node));
  }

  private toSymbol(document: vscode.TextDocument, node: OutlineNode): vscode.DocumentSymbol {
    const start = document.positionAt(node.start);
    const range = new vscode.Range(start, document.positionAt(node.end));
    const selection = new vscode.Range(start, document.positionAt(node.selectionEnd));
    const kind = node.children.length > 0 ? vscode.SymbolKind.Namespace : vscode.SymbolKind.Object;
    const symbol = new vscode.DocumentSymbol(node.name, '', kind, range, selection);
    symbol.children = node.children.map(child => this.toSymbol(document, child));
    return symbol;
  }
}
