
IMPORT WIZARD
  1. 
  - on File validation, apply first two, on the third apply the warning
  - Date parsing: ignore the format detection, all cells come as text. on the timezone shift, preserve the current timezone
  - amount parsing: use 0 when error, and strip commas.
  - exchange rate: perform the two. ask it when having usd movements
  - empty parse: apply it

  2. 
  - persistance: show the warning, force re-parsing
  - soft delete: deletion shouldn't happen until finishing step 2, so this deletion intent should be stored differently and only performed at the end
  - auto_duplicate: ok
  - p2 rule: make it opt-in
  - Missing subcategory change persistence: ok

  3. 
  - localStorage write failure: ok
  - Partial recurrent-matching failure: ignore it, acceptable for now
  - No confirmation before "Save & Finish": add confirmation
  - Balance sign for debit accounts: this doesnt happen
  - Post-import navigation: ok

Edge Cases — Business Logic Services: apply all fixes, with this comments:
  - existingTransactions scope ambiguity in DuplicationLogicService: enforce account id param
  - p2 rule: make it opt-in
  - No guard against matching across different accounts: enforce id match
  - todayDate drift: ignore
  - Post-close movements include PENDING transactions: include them
  - intDayRange is undefined: require the day range
  - Automatic matching at import: all-account scan: out of the scope of this iteration
  - Transfer amounts across currencies: wont happen

Data Integrity: apply all, with comments:
  - Balance Staleness: go for option A on both
  
Security: ignore them for now
Dashboards: apply what you consider best
navigation and ux: apply your recommendations