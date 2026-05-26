import { App, MarkdownView, TFile } from 'obsidian';
import ThePlugin from '@/main';
import { MatchData, Pinyin, SuggestionRenderer, Item as uItem } from '@/utils';
import FuzzyModal, { SpecialItemScore } from './modal';

type Item = uItem<{ level: number }>;

export default class HeadingModal extends FuzzyModal<Item> {
  index: { items: Item[] } = { items: [] };
  file: TFile;
  constructor(app: App, plugin: ThePlugin) {
    super(app, plugin);
    this.limit = 300;
  }
  setFile(file: TFile) {
    this.file = file;
    let heading = app.metadataCache.getFileCache(file)?.headings;
    if (!heading) return;
    if (!this.plugin.settings.heading.showFirstLevelHeading)
      heading = heading.filter((h) => h.level > 1);
    this.index.items = heading.map((h) => ({
      name: h.heading,
      pinyin: new Pinyin(h.heading),
      level: h.level,
    }));
  }
  getEmptyInputSuggestions(): MatchData<Item>[] {
    return this.index.items.map((p) => ({
      item: p,
      score: SpecialItemScore.emptyInput,
      range: null,
    }));
  }
  onChooseSuggestion(matchData: MatchData<Item>, evt: KeyboardEvent | MouseEvent): void {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    view.leaf.openLinkText('#' + matchData.item.name, this.file.path);
  }
  renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
    const renderer = new SuggestionRenderer(el)
      .render(matchData)
      .addIcon('heading-' + matchData.item.level);
    if (this.plugin.settings.heading.headingIndent) {
      let indent = this.plugin.settings.heading.showFirstLevelHeading
        ? matchData.item.level - 1
        : matchData.item.level - 2;
      indent *= 15;
      renderer.titleEl.style.marginLeft = indent + 'px';
    }
  }
}
