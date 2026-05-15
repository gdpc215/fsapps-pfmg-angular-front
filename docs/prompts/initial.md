I want to keep track of the transactions of my credit card, and the remaining balance. I work in a bank that:

- provides me with a downloadable list of the transactions, consisting of date (not time), description, and amount. Each time I get 80 movements, which means two files from different dates will surely have overlapping transactions.
- charges revolving interest on the cycle closing date. This charge doesn't appear anywhere, and if I want to keep track of it on a separate location, I should calculate it.

My transactions:
- can be in PEN and USD
- can be in process or posted. the downloaded list dont specify it.
- sometimes, when first imported and being in process, a transaction can have one description and one amount. once posted, both can change. I can detect this if i see it personally, so the first "in process" transaction should be deleted in favor of the "posted" transaction.

Configs:
	- Duplication collections: List of string collections, each string collection composed of two or more strings.

About categories and subcategories 
	- I want to categorize the transactions based on the content of the description 
	- There should be a list of categories ("Home", "technology", etc) and each one should have subcategories ("Housing" and "maintenance" for Home, etc)
	- The link should be done at the subcategory level. 
	- There should be a component where I could alter the list of categories and subcategories 
	- Also, a component to match them with trx descriptions, adding a string, a match type selection (start with, contains, etc) and the category-subcategory to assign when it happens.

About duplication detection:
	- Given the files will have overlapping transactions, I want to avoid entering duplicate transactions to the system, so i want to compare the incoming transactions against already posted transactions.
	- Matches should mark the incoming transaction as ignored, on these cases:
		○ First comparison should be exact date, description, currency and amount. 
		○ Second comparison should compare description and amount, date allowing for +-3 days, only for USD trx.
	- Second, given the nature of process and posted transactions, some duplications might need user validation before confirming. On these cases, the incoming transaction should have the possible detected duplication under it and both colored and marked as potential duplication, so the user can decide if it's actually a dupe or not, and perform the action required 
		○ First comparison should compare amount, description matching the 10 first characters, and +- 3 days. 
		○ Second comparison should match +-3 days and amount, but no description 
	- Third, custom description comparison. Considering also matching amount, currency and +-3 days. Description matching: Each incoming transaction should have its description compared to the Duplication collections (explained above), if any string of any collection is contained inside the description's string, take all the strings of the collection, and evaluate if the rest of candidate transactions contain any of the strings of the collection. Any hit is considered a potential match.

When importing, i want this to happen:
- I'll have the transaction list, and the balance at that moment.
- I should be asked for the currency rate for dollars at the import moment. Using that rate, fill the amountPen column with the converted value if it's in USD.
- display the list of incoming transactions, separated by day, showing the date, description, subcategory, amount, amount in Pen, and a contextual menu for additional options that I will add later. For now, the action "Add additional info" should be here, showing a pop-up with a text box for free comments for the user to add to the trx.
- show me on the same list the existing transactions from 5 days earlier of the lowest date of the file, as readonly, to find the possible "in process" transactions with an incoming "posted" version.
- show me a checkbox for the incoming transactions. Unchecked ones should be discarded.
- show me a trash icon for the already existing transactions. If clicked, that transaction should be deleted because it's most likely an "in process" trx
- after all the import process up to this point has been added, execute the duplication validation process explained above.
- execute the match for subcategories defined above, but allow me to change the selection.

The movement conciliation should happen like this:
	- I want to make sure that the sum of the movements matches the amount on my card.
	- For this, I want to have an interest charged movement (fictional, but needed for conciliation) on each cycle.
	- The formula, then, should be "sum of movements + interest = balance at closing"
	- over the month, i’ll be doing small reconciliations, adding “snapshots” and conciliations with the movements so far on the cycle. this is to reduce the work on the final conciliation day
	- If there’s a difference, carry it over on the snapshot. that will be dealt with during the cycle close
	- on the cycle closing day, there should be a movement that accounts for the difference, assigned on the closing day date.
	- Most likely, I will be executing conciliation some days after the closing date. What should happen then is (for the example, imagine we're doing this on the 16th):
		○ Take the entirety of movements from the past cycle day+1, up to the currency cycle date. (For example, if the closing date is 10, take the movements from the 11th of the past month up to the 10th of this month)
		○ Sum the movements, and sum it to the past cycle's balance. This is the first amount to compare
		○ Take the balance provided by the user, and subtract the sum of the movements between the cycle daye +1 to this day (in the example, from the day 11 to the 16th). This is the second amount to compare.
		○ Both amounts to compare should in theory be equal, and meant to be the balance at the closing date. If there's a difference, it should be added as the interest charge movement (on the example given, with date 10), to make them match. 
		○ The final cycle closing balance should be the second amount. Keep that on record, for the next cycle.

Do you have any questions before continuing? assign exploration, investigation and documentation to agents
