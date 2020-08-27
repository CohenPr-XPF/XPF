#!/usr/bin/env python3

import re
import argparse
import sys
import csv
import traceback
from collections import deque, defaultdict
from math import inf
import translate04 as translate
from contextRep import contextRep


def oneNyield(item, iterable):
    yield item
    for item in iterable:
        yield item

def getRep(fobj, a2ipa, minfreq=1):
    ret = contextRep()
    stats = {"nlines": 0,
             "skipped": 0,
             "missing": 0,
             "@words": dict()}
    
    ret.wordlist = deque()
    
    ret.stats = stats

    finalnr = re.compile("[\r\n]*$")
    
    ##
    ## Try to understand file type
    ##
    sniffLine = fobj.readline()
    sniffLine = re.sub(finalnr, "", sniffLine)
    if sniffLine.find("\t") >= 0 and len(sniffLine.split("\t")) == 2:
        sep = "\t"
    elif sniffLine.find(",") >= 0 and len(sniffLine.split(",")) == 2:
        sep = ","
    elif sniffLine.find(" ") >= 0 and len(sniffLine.split(" ")) == 2:
        sep = " "
    else:
        print("Could not understand frequencies file, not proceeding")
        return ret

    ##
    ## Try to figure whether there are headers
    ##
    try:
        int(sniffLine.split(sep)[-1])
        lines = oneNyield(sniffLine, fobj)
    except ValueError:
        lines = fobj

    for line in lines:
        stats["nlines"] += 1
        line = re.sub(finalnr, "", line)
        try:
            ##
            ## parse line
            ## 
            (word, freq) = line.split(sep)
            freq = int(freq)

            ##
            ## ignore low frequencies
            ##
            if freq < minfreq:
                stats["skipped"] += 1
                continue

            ##
            ## Translate
            ##
            translation = a2ipa.translate(word)
            if "@" in translation:
                stats["missing"] += 1
                stats["@words"][word] = {"freq":freq, "translation":translation}

            ##
            ## Add context to representation
            ##
            else:
                ret.wordlist.append({"word:": word, "translation": translation})
                ret.add(translation, freq)
            
            
        except Exception as err:
            print("Error in word frequency parsing. Offending line is {}, the message is: {}".format(repr(line), err), file=sys.stderr)
            exit(1)

        ##ret.precalc()
            
        ##for (wx, wordprops) in enumerate(ret.wordlist):
        ##    ret.wordlist[wx]["probs"] = ret.probs(wordprops["translation"])
            
    return ret


def main(argv):
    parser = argparse.ArgumentParser("Provide summary statistics for language and frequency files")
    
    ##
    ## Specifies the rules used for trsnslation
    ##
    parser.add_argument("-l", "--langrules", dest="langrules",
                        type=argparse.FileType('r', encoding="utf8"),
                        required=True,
                        help="language code rules file")


    ##
    ## Specifies a verifcation file, in any csv format. Headers are
    ## not expected.  The first columns is supposed to be a word, and
    ## the second is its ideal translation
    ##
    parser.add_argument("-c", "--check", dest="check",
                        default=None, type=argparse.FileType('r', encoding="utf8"),
                        help="file to use for verification")

    ##
    ## Allows to read date from some file (which should not be compressed)
    ##
    parser.add_argument("-r", "--read", dest="read",
                        default=sys.stdin,
                        type=argparse.FileType('r', encoding="utf8"),
                        help="file used for translation (word and frequency)")

    ##
    ## Add min frequency
    ##
    parser.add_argument("-m", "--min", dest="min",
                        default=1,
                        type=int,
                        help="minimal frequency to consider")

    ##
    ## Print summary?
    ##
    parser.add_argument("-N", "--no-summary", dest="nosummary",
                        default=False, action="store_true",
                        help="suppress summary information")

    ##
    ## Print all probs?
    ##
    parser.add_argument("-A", "--all-words", dest="allwords",
                        default=False, action="store_false",
                        help="Enumerate all words and probabilities")

    ##
    ## How many @ words?
    ##
    parser.add_argument("-@", "--max@", dest="max@",
                        default=10,
                        type=int,
                        help="number of @ words to include in summary")

    options = vars(parser.parse_args(argv))

    a2ipa = translate.alphabet2ipa(options["langrules"])

    
    if "check" in options and not options["check"] is None:
        allGood = a2ipa.check(options["check"])
        if not allGood:
            print("Verification failed, not processing additional data", file=sys.stderr)
            exit(1)

    ##ret = ((word, " ".join(a2ipa.translate(word)))
    ##       for  word in words)
    rep = getRep(options["read"], a2ipa, minfreq=options["min"])
    rep.precalc()

    (info, counts) = rep.informativity_counts()

    print("seg\tinformativity\t,count")
    for (count, seg) in sorted((-counts[seg], seg) for seg in counts):
        print("{seg}\t{info}\t{count}".format(seg=seg,
                                              info=info[seg],
                                              count=-count))

    ##
    ## Print summary information, if not suppressed
    #3
    if not options["nosummary"]:

        print("## Summary statistics:")
        print("##   processed (inc. skipped):", rep.stats["nlines"])
        print("##   skipped:", rep.stats["skipped"])
        print("##   %@ words:", round(rep.stats["missing"] /
                                      (rep.stats["nlines"] - rep.stats["skipped"])*100, 1))

        atwords = rep.stats["@words"]
        print("## Top missing:")
        for (nfreq, word, translation) in sorted((-atwords[word]["freq"], word, atwords[word]["translation"]) for word in atwords)[:options["max@"]]:
            print("##   {word} → '{translation}' ({freq})".format(word=word, translation=" ".join(translation), freq=-nfreq))
        
    
if __name__ == "__main__":
    main(sys.argv[1:])
