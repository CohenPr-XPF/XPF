#!/usr/bin/python3
from __future__ import print_function

from math import log
from collections import deque

class contextRep(object):

    def __init__(self):
        self.count = 0.0         # times this context was observed
        self.contexts = dict()   # continuation:context dictionary
        self.precals = None      # probs can be precalculated
        self.terminal = 0.0      # number of times this context was final
    
    def __repr__(self):
        return repr([self.count, self.terminal, self.contexts])

    def __str__(self):
        return repr(self)

    def add(self, seq, count, func=lambda x: None):
        """
        add a full sequence to the representation
        """
        if len(seq) > 0:
            key = seq[0]
            if not key in self.contexts:
                self.contexts[key] = contextRep()
            self.contexts[key].add(seq[1:], count, func)
        else:
            self.terminal += count

        self.count += count

    def prob(self, key, log2=False):
        """
        get the probability of observing a particular continuation in
        the given context
        """
        if self.precals is None:
            ret = self.contexts[key].count / self.count \
                  if key in self.contexts else 0.0
        else:
            ret = self.precals[key]

        return ret if not log2 else log(ret, 2)

    def probs(self, log2=False):
        """
        Get the probabilities of getting all continuations in the given
        context
        """
        if self.precals is None:
            ret = {key:self.prob(key, log2=log2) for key in self.contexts}
        else:
            ret = self.precals if not log2 \
                  else {p:log(self.precals[p], 2) for p in self.precals}
                  ##else {p:log(p, 2) for p in self.precals}
        return ret

    def precalc(self):
        """
        Create a static image of the probabilities
        """
        self.precals = self.probs()
        for key in self.contexts:
            self.contexts[key].precalc()


    def contextProb(self, seq, terminal=False):
        """
        Create for each item in a sequence the probability of observing
        it in the given context
        """
        context = self
        ret = deque()
        for key in seq:
            if context is not None and key in context.contexts:
                ret.append(context.prob(key, False))
                context = context.contexts[key]
            else:
                context = None
                ret.append(0.0)

        if terminal:
            if context is not None:
                ret.append(context.terminal / context.count)
            else:
                ret.append(0.0)
        return list(ret)
        
    def informativity_counts(self):
        """
        Create for each item in a sequence the probability of observing
        it in the given context
        """
        retvals = {key:(-log(self.contexts[key].count / self.count, 2))
                    for key in self.contexts}
        retcounts = {key:self.contexts[key].count for key in self.contexts}

        for key in self.contexts:
            (subvals, subcounts) = \
                self.contexts[key].informativity_counts()
            for key in subvals:
                (selfval, selfcount) = (retvals[key], retcounts[key]) \
                                       if key in retvals \
                                        else (0.0, 0.0)
                retvals[key] = (selfval*selfcount +
                                 subvals[key]*subcounts[key]) / (subcounts[key]+selfcount)
                retcounts[key] = selfcount + subcounts[key]
                

        return (retvals, retcounts)

    def informativity(self):
        (informativity, counts) = self.informativity_counts()
        return informativity


    def iter(self, terminal=False, log2=False):
        logfunc = (lambda x: -log(x, 2) if x < 1 else 0) if log2 else (lambda x: x)
        
        if self.terminal > 0:
            yield [{"seg":None, "prob":logfunc(self.terminal / self.count), "count":self.count}] if terminal else []

        for key in sorted(self.contexts):
            for cont in self.contexts[key].iter(terminal=terminal, log2=log2):
                yield [{"seg":key,
                        "prob":logfunc(self.contexts[key].count / self.count),
                        "count":self.contexts[key].count}
                ] + cont


    def __iter__(self):
        for value in self.iter(log2=True, terminal=False):
            yield value


    ##
    ## Returns a pure dictionary representation of the object
    ##
    def asdict(self):
        ret = {"count":  self.count,
               "contexts": {key: self.contexts[key].asdict() for key in self.contexts},
               "precals": self.precals is None,
               "terminal": self.terminal}
        return ret

    ##
    ## reconstruct an object from a dictionary (created by asdict)
    ## I failed to create a static method and couldn't bother more with it.
    ## The only real reason to use this method + todict is to save contextRep objects in R / json easily
    ##
    def populate(self, d):
        self.count = d["count"]
        self.terminal = d["terminal"]
        self.contexts = {key:contextRep().populate(d["contexts"][key]) for key in d["contexts"]}
        self.precals = None if d["precals"] is False else self.precalc()
        return self


    ##
    ## Object equality (only to check todict / populate)
    ##
    def __eq__(self, other):
        if isinstance(other, contextRep):
            return all([self.terminal == other.terminal,
                        self.count == other.count,
                        all(self.contexts[key] == other.contexts[key] if key in other.contexts else False
                            for key in self.contexts),
                        all(key in self.contexts for key in other.contexts)])
        else:
            return False
        
            
if __name__ == "__main__":

    c = contextRep()
    
    c.add("ab", 5)
    c.add("ac", 5)
    c.add("a", 5)
    c.add("c", 15)
    c.add("P AO1 R T N OY0".split(), 1)
    print(c)
    print(c.informativity())
    print(c.probs())
    print(c.contextProb("ab"))
    print(c.contextProb("a"))
    print(c.asdict())

    c2 = contextRep()
    c2.populate(c.asdict())
    print(c2)
    print(c2 == c)
    print(c.informativity() == c2.informativity())


    for v in c.iter(terminal=True):
        print(v)
