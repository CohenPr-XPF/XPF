# xpfcorpus (R)

Grapheme-to-phoneme transcription for about 200 languages with the rules of
the [XPF Corpus](https://cohenpr-xpf.github.io/XPF/). The R counterpart of the
Python package [xpfcorpus](https://github.com/CohenPr-XPF/xpfcorpus), giving
the same output: it runs the corpus's JavaScript engine
(`Code/translate04-node.js`) through the [V8](https://cran.r-project.org/package=V8)
package, so nothing besides R packages is needed.

```r
# install.packages("remotes")
remotes::install_github("CohenPr-XPF/XPF", subdir = "Code/R")

library(xpfcorpus)
xpf_transcribe(c("perro", "chico"), "es")
#> [1] "p e r o"  "tʃ i k o"
xpf_transcribe("perro", "es", sep = NULL)     # list of phoneme vectors
xpf_languages()                               # codes, scripts, metadata
tt <- xpf_transcriber("tt", "cyrillic")       # choose a script
xpf_verify("es")                              # check rules against verify words
xpf_transcriber("my", file = "my.yaml")       # your own rules (.json/.yaml/.rules)
```

Cite the corpus with `citation("xpfcorpus")`.

## Maintenance

The engine and language data are byte copies, refreshed by a script:

```sh
Code/R/tools/sync.sh            # copy Code/translate04-node.js and ../xpfcorpus data
Code/R/tools/sync.sh --check    # report anything out of date
```

Language files are stored as `inst/languages/lang_<code>.json` because
`con.json` (Constanza) is a reserved file name on Windows. Check before a
release with `R CMD build Code/R && R CMD check --as-cran xpfcorpus_*.tar.gz`
(run from a scratch directory).
