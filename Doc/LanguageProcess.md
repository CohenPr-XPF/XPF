# General guidelines

* Every language has an "owner": a single person responsible of
  handling that language. This person is in charge of updating the
  documentation as necessary, and will contact others to consult and
  perform individual parts.

* Our interest in languages is dictated by (a) the availability of
  word lists (e.g. from Crubadan, Open Subtitles), (b) the
  transparency of the alphabet, (c) language family diversity, and (d)
  good documentation on the phonology of the language. 

* All the files should be saved in utf8 encoding
  
# Language processing stages

## Data collection

* Collect all major available data from public sources. Internet
  source should be printed to PDF. Prominent sources include
  
    * Ethnologue, e.g. https://www.ethnologue.com/language/quz
	
	* Glottologue, e.g. https://glottolog.org/resource/languoid/id/cusc1236
	
	* Wikipedia, e.g. https://en.wikipedia.org/wiki/Cusco_Quechua
	
    Ideally, those sources should not be used directly, but refer to
    other sources that can more legitimately be cited (books,
    articles).
	
	A decent source for verification is Wiktionary, which often
    contains a number of words and their pronunication in different
    languages. Such form could be fairly annotation specific (at least
    in English there are several options) and are likely to be
    phonetic rather than phonemic
	
	
* All pdfs, scanned and otherwise, should be kept under
  /Scans/pdfs/_Language code and name_, e.g. `Scans/pdfs/ro_Romanian`

* Every resource should be documented in .bib format in
  Scans/pdfs/_Language code and name_.pdf. Notice that urls have a special
  format that includes urldate (and are otherwise `@misc`
  resources). Zotero can be used to handle most of this work,
  especially for urls. A .bib file is a text file that contains
  bibliographic entries such as:
  
    ```
  @misc{GlottologCuscoQuechua,
        title = {Glottolog 3.3 - {Cusco} {Quechua}},
        url = {https://glottolog.org/resource/languoid/id/cusc1236},
        urldate = {2018-09-17},
  }

  @Book{Zipf1935,
    Title                    = {The Psycho-biology of Language: an Introduction to Dynamic Philology},
    Author                   = {Zipf, George Kingsley},
    Publisher                = {Houghton, Mifflin},
    Year                     = {1935}
  }

  @Article{Zipf1929,
    Title                    = {{R}elative frequency as a determinant of phonetic change},
    Author                   = {Zipf, George Kingsley},
    Journal                  = {{H}arvard {S}tudies in {C}lassical {P}hilology},
    Year                     = {1929},
    Pages                    = {1--95},
    Volume                   = {15}
  }

   ```

* Documentation should be written in Rmarkdown (or plain markdown). If
  you are not comfortable with markdown (yet), use plain html, in a
  way that would be easily translatable to markdown (i.e. nothing
  fancy). A sample document may look like this:

    ```
	---
	title: Cusco Quechua
	---
	
	# Background 
	
	**Language family**: Quechuan / Quechua II / Southern Quechua / Cusco Quechua
	
	...
	
	# Phonology
	
	## Consonants
	
	...
	
	## Vowels
	
	...
	
	# Alphabet
	
	...
	
	# Rules
	
	(an abstract representation of the rules you come up with)
    ```

* A complete language should have at least the following files

	_langcode_.Rmd
	
	: The documentation of the language
	
	_langcode_.bib
	
	: The bibliography used for the documentation and rules
	
	_langcode_.rules
	
	: Rules to translate the language, as defined below
	
	_langcode_.verify
	
	: Sample word to ipa translations

# Directory

The domain is AD, the user name is your non-gmail brown user name, and
for mac you should use "/" whereas for Windows you should use "\"

`\\files.brown.edu\research\CLPS_CohenPriva_Lab\XPF`

`//files.brown.edu/research/CLPS_CohenPriva_Lab/XPF`

# Rules

`translate04.py` represents the current stage of how rules should be
written. To test your rules you can use `python3` (which could be
called `python` if that's what you installed), the name of the script
(`translate02.py`), `-l` _rules.file_, _word1_, _word2_, _word3_,
where _rules.file_ is a csv file with the columns `type`, `sfrom`, `sto`,
`weight`, `precede`, `follow`, and `comment`, as in the following
example

```
#
# Lines starting with # are ignored
#
type,sfrom,sto,weight,precede,follow,comment
class,front,e|i,,,,
class,passthrough,[abdefiklmnopstu],,,,
sub,k,k,1,,,
sub,c,s,1,,{front},
sub,c,k,0.5,,,
sub,g,ɡ,1,,,
sub,c,tʃ,2,,h,
sub,h,,2,c,,
sub,({passthrough}),\1,0.1,,,
ipasub,\b(.*)\b \1,\1:,1,,,
word,1,u n o,,,,
```

`translate04.py` accepts several parameters to make this process easier:

-l

: specifies the rules file (as described above), which should be in
  csv format. #-initial lines are ignored.
  
-v 

: specifies the log level (higher → more information)

-c 

: specifies the verification file, which should be in csv or tsv
  format. #-initial lines are ignored. The first column should contain
  the word, and the second column its translation. For example:
  
    ```
	# Test ch rule
	che,tʃ e
	# Test c[ie] rule
	ci,s i
	ce,s e
	```


-r 

: specifies a file (`-` for standard input), from which words should
  be read for translation. Only the first word in every line is read,
  to facilitate a use case with a counts column.


## _word_ rules

Word rules are plain substitution rules. If a word matches the "sfrom"
column, it is replaced by the _sto_ column, and avoids further
processing.

## _pre_ rules

Preprocessing (_pre_) rules are translation tables from alphabets to
alphabets, and apply before `.lower()`. They are meant to catch a
number of cases in which lowercase processing may go wrong,
e.g. Turkish uppercase _I_, which should lowerase to dotless
_i_. _sfrom_ and _sto_ have to be equal-sized strings, such that every
character in _sfrom_ would be translated to the identical-position
character in _sto_. 

```
type,sfrom,sto,...
pre,"Iİ","ıi"
```

Theoretically, it could be used to collapse meaningless distinctions,
e.g. between various kinds of middle-dots, as bellow, but those should
be dealt with using character classes, unless that system breaks for
some reason.

```
pre,··‧⸱⋅,·····
```

## _match_ rules

Match rules are a way to avoid the computation-heavy regular
expression matching process that _sub_ rules require. They are similar
to _word_ rules, but apply at the level of a single character: they
direct to replace a single character, e.g. "탈" with some string,
which may contain variables, e.g. "{T} {A} {L}." If a character is
matched by a match rule (and only one match rule may exist, per
character), that rule would apply, and no sub rules would be
compouted.  The original issue was Korean, in which it is easy to tell
what a character means, but there are thousands of
characters. Match rules only use two fields, _sfrom_, and _sto_.

_sfrom_

: represents **one** alphabet letter (as defined by the utf8
standard)

_sto_

: zero or more phonemes (space-separated) that the letter should
 translate to. The phonemes should be in IPA.


## _sub_ rules

Sub rules are the core part of the translation scheme. A rule applies
if _sfrom_ matches the letter, _precede_ matches the preceding
context, _follow_ matches the following context, and the _weight_ is
the highest of all matching rules (the behavior is not defined if
multiple rules with identical weights match). If no rule matches, the
letter would be translated to some non-IPA default, currently
`@`. Every property (except weight) can have _class_ rules.

_sfrom_

: represents **one** alphabet letter (as defined by the utf8
standard)

_sto_ 

: zero or more phonemes (space-separated) that the letter should
 translate to. The phonemes should be in IPA.


_precede_

: A regular expression that must match the preceding context. This
  expression ends with `$` (added by the program), to make sure that
  the expression would match the context that immediately precedes
  _sfrom_. `^` in _precede_ would therefore designate "beginning of
  word," as `^$` is an empty string.

_follow_

: Similar to _precede_, but for the following context, and starts with
  `^`, to make sure it applies to the context immediately following
  the letter in question. `$` would therefore designate "end of word,"
  as "'^$' is an empty string.

_weight_

: the relative priority of the rule (higher values will override lower
  values). The goal is to designate rules that take priority over
  other rules. If we have a default rule for `c` (translate to k), and
  a specific rule for `c` (translate to tʃ when `h` follows), we want
  to make sure the specific rule would apply rather than the
  lower priority rule. The following is an example
  
  
    ```
    type,sfrom,sto,weight,precede,follow,comment
	sub,c,k,1,,,"Default rule for c"
	sub,c,tʃ,2,,h,"Rule should apply rather than the default rule"
	```


## _class_ rules

Class rules define internal substitution guidelines meant to improve
readability or allow reuse to a recurring element. As with word rules,
only the _sfrom_ and _sto_ columns are used. _sfrom_ defines the name
of the class, and _sto_ the value of the class. The following shows
how to make a non-latin alphabet more readable in the sub rule section.

```
type,sfrom,sto,...
class,pi,π,
sub,{pi},p,...
```

The following is an example of reuse

```
type,sfrom,sto,precede,follow,...
class,vowels,[aeuio],
sub,c,s,,{vowels},...
sub,g,x,,{vowels},...
```

## _ipasub_ rules


_ipasub_ rules perform substitutions on the output IPA directly, and
should be used sparingly. _sfrom_ designates the input pattern, _sto_
the replacement string, and _weight_ the order of application, from
heaviest to lightest. These can be as complex as python3 allows, but
should ideally be used to change what constitutes a phoneme, as in the
following cases


```
type,sfrom,sto,...,comment
ipasub,({consonant}) \1,\1 ː,...,double consonants are phoneme + length
ipasub,({vowel}) \1,\1ː,...,double vowels are distinct from singletons (are different phonemes)
ipasub, ʷ,ʷ,...,labialized elements are distinct phonemes (kʷ and k are not the same)
	ipasub,ʲ, ʲ,...,palatalization is not phonemic (but not allophonic either)
```



# Lenition

Consonant lenition processes are a range of phonological processes that tend to
result in shorter duration and higher intensity, and are more likely
to occur in fast or casual speech, between vowels (or non-nasal
sonorants; sometimes a single vowel suffices), and in low-information
(frequent, predictable) contexts. These include:

Degemination

: A long consonant becomes shorter, e.g. tː→t (Classical Hebrew _dov_ (sg.) vs. dubːim -- degemination and spirantization)

Spirantization

: A stop becomes a fricative, e.g. t→θ (as in _water_ vs. _Waßer_)

Voicing

: A voiceless obstruent becomes voiced, e.g. t→d (as in _of_ vs. _off_)

Debuccalization

: Loss of place of articulation, e.g. t→ʔ, s→h (as in button, Cockney English _water_)

Tapping

: t→ɾ (as in American English _water_)

Approximantization

: t→l (as in _was_ vs. _were_, _corpus_ vs. _corpora_)

Gliding

: c→j (as in _day_ vs. _Tag_)

Deletion

: t→0 (as in _jus'_)


For each of the languages you process, you are supposed to document
any existing lenition processes in a designated section in the
language documentation file.

