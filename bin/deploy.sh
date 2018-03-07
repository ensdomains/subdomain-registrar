#!/usr/bin/env sh

# Run this script to deploy the app to Github Pages.

RED='\033[0;31m'
BRANCH=gh-pages

# Exit if any subcommand fails.
set -e

# Check if any changes are uncommited.
if ! git diff-files --quiet --ignore-submodules --
then
  echo >&2 "${RED}Please commit your changes first before deploying!"
  git diff-files --name-status -r --ignore-submodules -- >&2
  exit 0
fi

echo "Started deploying"

# Checkout gh-pages branch.
if [ `git branch | grep $BRANCH` ]
then
  git branch -D $BRANCH
fi
git checkout -b $BRANCH

# Build site.
npm install
truffle compile
npm run build

# Delete and move files.
find . -maxdepth 1 ! -name 'build' ! -name '.git' ! -name '.gitignore' -exec rm -rf {} \;
mv build/* .
rm -R build/
echo "now.ens.domains" > CNAME

# Push to gh-pages.
git add -fA
git commit --allow-empty -m "$(git log -1 --pretty=%B) [ci skip]"
git push -f -q origin $BRANCH

# Move back to previous branch.
git checkout -
npm install

echo "Deployed Successfully!"

exit 0
