#!/usr/bin/env python3

import re
import argparse
import sys
import csv
from collections import deque, defaultdict
from math import inf


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
        ##chartr = dict()
        self.words = dict()
        self.NO_TRANSLATE = missing
        self.loglevel = loglevel

        
        with langrules as csvsource:
            rules = csv.DictReader(csvsource)
            for rule in rules:
                ##
                ## Deal with classes
                ##
                if rule["type"] == "class":
                    self.classes[rule["sfrom"]] = rule["sto"]

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
                ## Translate to workable syntax
                ##
                ##elif rule["type"] == "chartr":
                ##    chartr[rule["sfrom"]] = rule["sto"] if len(rule["sto"]) else None

                ##
                ## No such rule
                ##
                else:
                    print("Unrecognized rule type ({type}), with sfrom={sfrom}, and sto={sto}".format(**rule), file=sys.stderr)

                if self.loglevel > 1:
                    print("Rule added:", rule, file=sys.stderr)


        ##
        ##  If we translate we must translate *everything*. Otherwise
        ##  we get foreign alphabet counting as native words. This is
        ##  implemented as returning NO_TRANSLATE to everything except the
        ##  translation codes.
        ##
        ##if len(chartr) > 0:
        ##    self.chartr = defaultdict(lambda: self.NO_TRANSLATE)
        ##    self.chartr.update(str.maketrans(chartr).items())
            
        
        ##print(self.classes)



    def translate(self, source):
        ##
        ## fully translated words
        ##
        if source in self.words:
            return self.words[source]

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
        

def main(argv):
    parser = argparse.ArgumentParser("Translate words to ipa")
    parser.add_argument("-l", "--langrules", dest="langrules",
                        default="es.rules", type=argparse.FileType('r', encoding="utf8"),
                        help="language code rules file")

    parser.add_argument("-v", "--verbose", dest="loglevel", 
                        default=0, type=int, 
                        help="Error level specification")

    parser.add_argument("words", nargs="*")
    
    options = vars(parser.parse_args(argv))

    a2ipa = alphabet2ipa(options["langrules"], loglevel=options["loglevel"])
    ##print(options)

    ret = [" ".join(a2ipa.translate(word))
           for  word in options["words"]]

    return ret



if __name__ == "__main__":
    for output in main(sys.argv[1:]):
        print(output)
