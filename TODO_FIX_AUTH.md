# Auth Context Fix Plan

## Problem
- App.tsx uses LocalAuthContext but components import from AuthContext
- This causes context provider mismatch and black screen

## Files to Update (change import from AuthContext to LocalAuthContext):
- [ ] src/pages/Register.tsx
- [ ] src/pages/MyItems.tsx
- [ ] src/pages/Login.tsx
- [ ] src/pages/Index.tsx
- [ ] src/contexts/ItemsContext.tsx
- [ ] src/components/Navigation.tsx

## Steps Completed:
- [x] Analysis complete
- [x] Plan approved by user
