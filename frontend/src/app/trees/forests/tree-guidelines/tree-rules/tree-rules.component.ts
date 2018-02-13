import { Component, Input, OnInit } from '@angular/core';
import { FilterPipe } from '../../../../_pipes/filter.pipe';
import { LineBreakFormatterPipe } from '../../../../_pipes/line-break-formatter.pipe';
import { UtilService } from '../../../../_services/util.service';
import { MarkdownService } from 'ngx-md';
import { ForestService } from '../../../_services/forest.service';

@Component({
  selector: 'app-tree-rules',
  templateUrl: './tree-rules.component.html',
  providers: [FilterPipe, LineBreakFormatterPipe]
})
export class TreeRulesComponent implements OnInit {
  @Input() forest: any;
  species: any;

  constructor(
    private filter: FilterPipe,
    private lineBreakFormatter: LineBreakFormatterPipe,
    public util: UtilService,
    private markdown: MarkdownService,
    public forestService: ForestService
  ) {}

  ngOnInit() {
    if (this.forest) {
      this.forestService.getJSON(this.forest.forestAbbr).subscribe(speciesData => {
        this.species = speciesData.treeSpecies;
      });

      this.markdown.renderer.text = (text: string) => {
        return text
          .replace('TREEHEIGHT', this.forest.treeHeight)
          .replace('STUMPHEIGHT', this.forest.stumpHeight)
          .replace('STUMPDIAMETER', this.forest.stumpDiameter);
      };

      this.markdown.renderer.heading = (text, level) => {
        return `<h${level}>${text}</h${level}>`;
      };

    }
  }
}
