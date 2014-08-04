#!/bin/bash
# lazy...
lessc -x --include-path=node_modules/bootstrap/less styles/styles.less client/css/styles.css

git add --all

git commit -m "still have some work to do"

git push

cp -rf client ../tmp-gh

git checkout gh-pages

cp -rf ../tmp-gh/* ./

git status

git add --all

git commit -m "still have some work to do"

git push

git checkout master

rm -rf ../tmp-gh
