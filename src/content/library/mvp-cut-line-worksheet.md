---
title: MVP cut-line worksheet
description: A worksheet for deciding which features belong in a first release and which wait, using the customer job, the riskiest assumption and a clear cut line.
kind: worksheet
instructions: List every feature idea first, then score each against the customer job and the riskiest assumption. Draw the cut line where the smallest release can still test that assumption.
updated: 2026-10-06
---

## 1. Define the release

- **Customer and job:** who is this for, and what job must it do?
- **Riskiest assumption:** the one belief that, if wrong, makes the product pointless.
- **What a successful test looks like:** an observable result, stated before you build.

## 2. List the candidate features

Write every idea, including ones you suspect are too big. Do not filter yet.

| # | Feature | Customer job it serves | Needed to test the riskiest assumption? (yes or no) | Effort (S, M, L) | Risk if missing (low, medium, high) |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |

## 3. Sort into three groups

- **Must have:** without it, the customer cannot complete the job or you cannot test the assumption.
- **Should have:** improves the experience but does not change the test.
- **Later:** everything else. Write it down so it is not lost, then leave it out.

## 4. Draw the cut line

1. Put the must-have items at the top of a list, ordered by dependency.
2. Add up the effort. If the total is more than the team can ship in one focused cycle, remove the item with the lowest value to the test.
3. Write the cut line under the last item that stays.

**Inside the release:**

1. 
2. 
3. 

**Cut line**

**Waiting list:**

- 

## 5. Checks before you start

- \[ \] Every item inside the line serves the customer job.
- \[ \] The riskiest assumption can be tested with this release alone.
- \[ \] You know who the first users are and how they will reach the product.
- \[ \] Anything legal, security or accessibility related that must exist at first use is inside the line.
- \[ \] The team agrees on what "done" means for each item.

## 6. Review

| Date | What shipped | What the test showed | What changes in the next cut |
|---|---|---|---|
| | | | |
