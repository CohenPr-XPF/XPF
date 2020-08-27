#!/bin/bash


##
## ignore low frequencies so we don't save time dealing with
## them. Default: ignore nothing.
##
minfreq=$(test "$2" && echo "$2" || echo 0)


tf=$(mktemp)
cat | awk "\$2>=$minfreq" |                ## remove low freqs if any
    bzip2 -9 > ${tf}                       ## first save the file,
					   ## sorted by freq

lastfreq=$(bzcat ${tf} |                   ## revisit the file
	       sort -nr -k 2,2 -k 1,1 |    ## sort to find top $1 freq
	       head -n "$1" |              ## find the top $1 rlines
	       tail -n1 |                  ## keep only last line
	       (read w freq; echo $freq))  ## it's the second field

bzcat ${tf} | awk "\$2>=$lastfreq"         ## use awk to remove lower freqs

rm -f ${tf}
