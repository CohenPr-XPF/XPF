## Submission

First submission.

## R CMD check results

0 errors | 0 warnings | 0 notes (local, Ubuntu, R CMD check --as-cran)

## Notes for the reviewer

* The package bundles 'JavaScript' source (inst/js/translate04.js, not
  minified) that it runs through 'V8'. It is the reference implementation of
  the XPF corpus rules, by the package authors, under the package licence.
* inst/languages/ holds the rule data for about 200 languages (3.5 MB
  uncompressed, about 300 KB in the tarball).
