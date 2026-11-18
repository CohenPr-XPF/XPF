# The V8 context that runs translate04.js. One per R session, created on
# first use. Transcribers live inside it, keyed by id strings.

.xpf <- new.env(parent = emptyenv())

xpf_context <- function() {
  if (is.null(.xpf$ctx)) {
    ctx <- V8::v8()
    ctx$source(system.file("js", "translate04.js", package = "xpfcorpus", mustWork = TRUE))
    ctx$source(system.file("js", "bridge.js", package = "xpfcorpus", mustWork = TRUE))
    .xpf$ctx <- ctx
    .xpf$transcribers <- list()
    .xpf$counter <- 0L
    # Not sample(): that would move the user's random number stream.
    .xpf$token <- paste0(Sys.getpid(), "-", format(as.numeric(Sys.time()) * 1e6, scientific = FALSE))
  }
  .xpf$ctx
}

js_call <- function(fun, ...) {
  xpf_context()$call(paste0("xpfR.", fun), ...)
}

# Read a whole text file as one UTF-8 string.
read_text <- function(path) {
  txt <- readLines(path, encoding = "UTF-8", warn = FALSE)
  txt <- paste(txt, collapse = "\n")
  # Drop a byte-order mark, which would otherwise end up in the first rule.
  sub("^\ufeff", "", txt)
}

# Engine entry points --------------------------------------------------------

engine_load_json <- function(id, json_text, script) {
  js_call("loadJSON", id, json_text, script)
  invisible(id)
}

engine_load_rules <- function(id, rules_text) {
  js_call("loadRules", id, rules_text)
  invisible(id)
}

engine_transcribe <- function(id, words) {
  out <- js_call("transcribe", id, as.character(jsonlite::toJSON(words)))
  res <- jsonlite::fromJSON(out, simplifyVector = FALSE)
  lapply(res, function(p) as.character(unlist(p)))
}

engine_parse_table <- function(text) {
  rows <- jsonlite::fromJSON(js_call("parseTable", text), simplifyVector = FALSE)
  lapply(rows, function(r) as.character(unlist(r)))
}
