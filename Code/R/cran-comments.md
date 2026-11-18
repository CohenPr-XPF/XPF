## Submission

First submission.

## R CMD check results

0 errors | 0 warnings | 0 notes (local, Ubuntu, R CMD check --as-cran)

## Notes for the reviewer

* The package bundles 'JavaScript' source (inst/js/translate04.js, not
  minified) that it runs through 'V8'. It is the reference implementation of
  the XPF corpus rules, by the package authors, under the package licence (MIT).
* The language data is not included: it is under CC BY-NC-SA 4.0, so
  xpf_download() fetches it on request into tools::R_user_dir(). Examples
  and tests that need it run only when it is installed; on CRAN, the tests
  use a small made-up language shipped in inst/extdata.
