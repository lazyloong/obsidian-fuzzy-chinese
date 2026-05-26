import { getIcon } from 'obsidian';
import { MatchData } from './type';

export default class SuggestionRenderer {
  readonly containerEl: HTMLElement;
  readonly contentEl: HTMLElement;
  readonly noteEl: HTMLElement;
  readonly titleEl: HTMLElement;
  flairEl: HTMLElement;
  toHighlightEl: HTMLElement;
  title: string = '';
  note: string = '';
  hasIcon: boolean = false;
  constructor(containerEl: HTMLElement) {
    containerEl.addClass('fz-item');
    this.containerEl = containerEl;
    this.contentEl = this.containerEl.createEl('div', { cls: 'fz-suggestion-content' });
    this.titleEl = this.contentEl.createEl('div', { cls: 'fz-suggestion-title' });
    this.noteEl = this.contentEl.createEl('div', {
      cls: 'fz-suggestion-note',
    });
    this.toHighlightEl = this.titleEl;
  }
  setToHighlightEl(name: 'title' | 'note') {
    this.toHighlightEl = this[`${name}El`];
    return this;
  }
  setIgnore() {
    this.containerEl.addClass('mod-downranked');
    return this;
  }
  render(matchData: MatchData<any>) {
    const range = matchData.range;
    let text: string;
    let index = 0;
    if (this.title == '') this.setTitle(matchData.item.name);
    if (this.toHighlightEl == this.titleEl) {
      text = this.title;
      this.noteEl.innerText = this.note;
    } else {
      text = this.note;
      this.titleEl.innerText = this.title;
    }
    if (range) {
      for (const r of range) {
        this.toHighlightEl.appendText(text.slice(index, r[0]));
        this.toHighlightEl.createSpan({
          cls: 'suggestion-highlight',
          text: text.slice(r[0], r[1] + 1),
        });
        index = r[1] + 1;
      }
    }
    this.toHighlightEl.appendText(text.slice(index));
    return this;
  }
  setTitle(text: string) {
    this.title = text ?? '';
    return this;
  }
  setNote(text: string) {
    this.note = text;
    return this;
  }
  addIcon(icon: string) {
    if (!this.flairEl)
      this.flairEl = this.containerEl.createEl('span', {
        cls: 'suggestion-flair',
      });
    this.flairEl.appendChild(getIcon(icon));
    this.hasIcon = true;
    return this;
  }
}
