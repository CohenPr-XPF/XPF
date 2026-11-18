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
xpf_download()        # once: the corpus rules (CC BY-NC-SA 4.0), ~350 KB from GitHub
xpf_transcribe(c("perro", "chico"), "es")
#> [1] "p e r o"  "tʃ i k o"
xpf_transcribe("perro", "es", sep = NULL)     # list of phoneme vectors
xpf_languages()                               # codes, scripts, metadata
tt <- xpf_transcriber("tt", "cyrillic")       # choose a script
xpf_verify("es")                              # check rules against verify words
xpf_transcriber("my", file = "my.yaml")       # your own rules (.json/.yaml/.rules)
```

Cite the corpus with `citation("xpfcorpus")`.

## License

The package code is MIT. The corpus rules it downloads are under
CC BY-NC-SA 4.0, which excludes commercial use.

## Maintenance

The engine is a byte copy of `Code/translate04-node.js`, refreshed by a script:

```sh
Code/R/tools/sync.sh            # copy the engine
Code/R/tools/sync.sh --check    # report if it is out of date
```

The language data is not in the package. `xpf_download()` fetches the
xpfcorpus repository tarball and installs its language files in
`xpf_data_dir()` as `lang_<code>.json` (`con.json`, Constanza, is a
reserved file name on Windows). To test with unpushed data, set
`XPFCORPUS_TEST_DATA` to a local xpfcorpus checkout. Check before a
release with `R CMD build Code/R && R CMD check --as-cran xpfcorpus_*.tar.gz`
(run from a scratch directory).
