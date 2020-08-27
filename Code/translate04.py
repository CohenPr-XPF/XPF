#!/usr/bin/env python3

import re
import argparse
import sys
import csv
import traceback
from collections import deque, defaultdict
from math import inf


def sniff(filestream):
    ##sample = csv.Sniffer().sniff(filestream.read(1024))
    lines = list(line for line in filestream if not (line.startswith("#") or len(line) == 0))
    if all(line.find("\t") >= 0 for line in lines):
        dialect = csv.get_dialect("excel-tab")
    else: 
        sample = "\n".join(lines)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except Exception as ex:
            print("Could not determine delimiter type, proceedings as excel csv", file=sys.stderr)
            dialect = csv.get_dialect("excel")
    return (lines, dialect)


class subrule(object):
    ##
    ## simple wrapper for sub rules
    ##
    def __init__(self, values, classes):
        for key in ["sfrom", "sto", "precede", "follow", "weight"]:
            value = values[key]

            ##
            ## handle classes (and subclasses)
            ##
            while re.search("{.*}", value):
                value = value.format(**classes)
            self.__dict__[key] = value

        self.weight = float(self.weight)
        self.sfrom = re.compile(self.sfrom)
        self.precede = re.compile(self.precede+"$")
        self.follow = re.compile("^"+self.follow)

    def subScore(self, sfrom, precede, follow):
        if self.sfrom.match(sfrom) and self.precede.search(precede) and self.follow.search(follow):
            return self.weight
        else:
            return None

    def sub(self, x):
        return self.sfrom.sub(self.sto, x)

    def __repr__(self):
        return repr(self.__dict__)

    def __lt__(self, other):
        if not isinstance(other, subrule):
            raise Exception("Incompatible types for comparison")
        return [self.weight] < [other.weight]
    
            
class alphabet2ipa(object):
    ##
    ## interpretation of rules files
    ##

    classes = None
    subs = None
    ##chartr = None
    
    def __init__(self, langrules, missing="@", loglevel=0):
        self.classes = dict()
        self.subs = set()
        self.ipasubs = set()
        self.words = dict()
        self.matches = dict()
        self.pre = str.maketrans("", "")
        self.NO_TRANSLATE = missing
        self.loglevel = loglevel

        
        with langrules as csvsource:
            ##rules = csv.DictReader(csvsource)
            (csvsource, dialect) = sniff(csvsource)
            rules = csv.DictReader(csvsource, dialect=dialect)
            for rule in rules:
                if self.loglevel > 2:
                    print("Rule found:", rule, file=sys.stderr)

                try:
                    
                    ##
                    ## Pre equivalences
                    ##
                    if rule["type"] == "pre":
                        self.pre = str.maketrans(rule["sfrom"], rule["sto"])

                    ##
                    ## Deal with classes
                    ##
                    elif rule["type"] == "class":
                        self.classes[rule["sfrom"]] = rule["sto"]

                    ##
                    ## Deal with match rules
                    ##
                    elif rule["type"] == "match":
                        value = rule["sto"]
                        while re.search("{.*}", value):
                            value = value.format(**self.classes)
                        self.matches[rule["sfrom"]] = value

                    ##
                    ## Deal with sub rules
                    ##
                    elif rule["type"] == "sub":
                        newrule = subrule(rule, self.classes)
                        self.subs.add(newrule)

                    ##
                    ## Deal with IPA sub rules
                    ##
                    elif rule["type"] == "ipasub":
                        newrule = subrule(rule, self.classes)
                        self.ipasubs.add(newrule)

                    ##
                    ## Deal with whole word substitutions
                    ##
                    elif rule["type"] == "word":
                        self.words[rule["sfrom"]] = rule["sto"].split()


                    ##
                    ## No such rule
                    ##
                    else:
                        print("Unrecognized rule type ({type}), with sfrom={sfrom}, and sto={sto}".format(**rule), file=sys.stderr)
                        continue

                except Exception as ex:
                    errInfo = sys.exc_info()
                    traceback.print_exception(*errInfo)
                    print("Error processing rule, but resuming processing other rules. Rule details: {}".format(rule, ex), file=sys.stderr)
                    continue

                    
                if self.loglevel > 1:
                    print("Rule added:", rule, file=sys.stderr)




    def translate(self, source):
        ##
        ## fully translated words
        ##
        if source in self.words:
            return self.words[source]

        ##
        ## preprocess using pre, and turn to lowercase
        ##
        source = source.translate(self.pre).lower()

        ##
        ## If there are character-based translations, apply them first
        ## (for Cyrillic and other non-latin scripts)
        ##
        ##if not self.chartr is None:
        ##    source = source.translate(self.chartr)

        sourceList = re.findall(".", source)
        targetList = deque()
        for (sx, sfrom) in enumerate(sourceList):

            ##
            ## If there's a match rule: translate "as is" (and skip costly regular expressions)
            ##
            if sfrom in self.matches:
                translation = self.matches[sfrom]

            ##
            ## Otherwise, look for all matches
            ##
            else:
                ##
                ## prepare context
                ##
                precede = "".join(source[:sx])
                follow = "".join(source[sx+1:])
                
                ##
                ## perform all possible translations
                ##
                translations = [(rule.subScore(sfrom, precede, follow), rule.sub(sfrom)) for rule in self.subs]
                
                ##
                ## Exclude translations that didn't apply
                ##
                translations = [pair for pair in translations if not pair[0] is None]
                
                ##
                ## Choose best translation
                ##
                translation = sorted(translations)[-1][-1] if len(translations) > 0 else self.NO_TRANSLATE

            if len(translation) == 0:
                continue
            
            targetList.append(translation)

        targetString = " ".join(targetList)
        for (weight, rule) in sorted((-rule.weight, rule)
                                     for rule in self.ipasubs):
            targetString = rule.sub(targetString)
        


        return list(targetString.split())


    def check(self, cfile):
        ##
        ## Check that words translate as they should. Returns True if
        ## they all do (or if there are no words). Unless logevel is
        ## negative, mismatches are printed.
        ##


        ##
        ## Open the file, regardless of csv formats, excluding comment lines
        ##
        (csvsource, dialect) = sniff(cfile)
        data = csv.reader(csvsource, dialect=dialect)


        ##
        ## Iterate over all lines
        ##
        allGood = True                                     ## default is that it's all good
        for values in data:
            try:
               word = values[0]
               shouldbe = values[1]
            except Exception as ex:
                errInfo = sys.exc_info()
                allGood = False
                traceback.print_exception(*errInfo)
                print("Error processing verification statement, but resuming processing other statements. Statement details: {}".format(values, ex), file=sys.stderr)
                continue
            
            translation = " ".join(self.translate(word))   ## translate returns a list, change to spaces
            if self.loglevel > 2:
                print("Does '{}' translate to '{}'?".format(word, shouldbe), file=sys.stderr)

            if not shouldbe == translation:                ## if wrong translation
                allGood = False                            ##    not all translations are good
                if self.loglevel >= 0:
                    print("Verification error, '{}' was translated to '{}', not '{}'"
                          .format(word, translation, shouldbe)
                          , file=sys.stderr)

            if self.loglevel > 0:
                print("Word '{} ({})' translated to '{}'".format(word, shouldbe, translation)
                      , file=sys.stderr)
                    
        return allGood

def concatenate(*seqs):
    for seq in seqs:
        for item in seq:
            yield item
    

def main(argv):
    parser = argparse.ArgumentParser("Translate words to ipa")
    
    ##
    ## Specifies the rules used for trsnslation
    ##
    parser.add_argument("-l", "--langrules", dest="langrules",
                        default="es.rules", type=argparse.FileType('r', encoding="utf8"),
                        help="language code rules file")

    ##
    ## Specifies the log level
    ## 
    parser.add_argument("-v", "--verbose", dest="loglevel", 
                        default=0, type=int, 
                        help="Error level specification")


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
                        default=None, type=argparse.FileType('r', encoding="utf8"),
                        help="file used for translation (read up to first space)")

    ##
    ## Any following words would be translated
    ##
    parser.add_argument("words", nargs="*")
    
    options = vars(parser.parse_args(argv))

    a2ipa = alphabet2ipa(options["langrules"], loglevel=options["loglevel"])
    ##print(options)

    if "check" in options and not options["check"] is None:
        allGood = a2ipa.check(options["check"])
        if not allGood:
            print("Verification failed, not processing additional data", file=sys.stderr)
            return []


    if "read" in options and not options["read"] is None:
        readwords = (fields.replace(",", " ").split()[0] for fields in options["read"])
    else:
        readwords = []
            
    words = concatenate(options["words"], readwords)
    
    ret = ((word, " ".join(a2ipa.translate(word)))
           for  word in words)

    return ret



if __name__ == "__main__":
    for output in main(sys.argv[1:]):
        print("\t".join(output))
