# Data

Each of the language files found in this folder (and the `./compromised` folder) contain the files listed below. I have linked the relevant sections within the manual for more detail.

* An `.Rmd` (and corresponding `.html`) file that outlines the language specific [description](https://cohenpr-xpf.github.io/XPF/manual/xpf_manual.pdf#Language%20Descriptions).
* A `.rules` file that contains the computational [grammar](https://cohenpr-xpf.github.io/XPF/manual/xpf_manual.pdf#Language%20Grammars) needed to translate language specific orthographic characters to their phonemes.
* A `.verify.csv` file that contains language specific sample words and their translations used to [verify](https://cohenpr-xpf.github.io/XPF/manual/xpf_manual.pdf#Grammar%20Verification) and confirm the validity of the `.rules` file.
* A `.bib` file that contains the sources referenced within the `.Rmd`.

The `langs_list.tsv` file is a consolidation of relevant language identifiers and directory paths to make for more efficient analyses.
