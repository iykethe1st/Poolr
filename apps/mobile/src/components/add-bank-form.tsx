import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HTTPError } from "ky";
import {
  useBanks,
  getBankAccountErrorMessage,
  useResolveAccount,
  useSaveBankAccount,
} from "@/hooks/use-bank-account";
import { useColors } from "@/lib/colors";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddBankForm({ onSuccess, onCancel }: Props) {
  const {
    data: banks = [],
    isLoading: banksLoading,
    isError: banksFailed,
    error: banksError,
    refetch: refetchBanks,
  } = useBanks();
  const resolve = useResolveAccount();
  const save = useSaveBankAccount();

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [error, setError] = useState("");

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedBank = banks.find((b) => b.code === bankCode);
  const canResolve = !!bankCode && accountNumber.length === 10;

  async function handleVerify() {
    setError("");
    try {
      const result = await resolve.mutateAsync({ bankCode, accountNumber });
      setResolvedName(result.accountName);
    } catch (err) {
      setError(
        await getBankAccountErrorMessage(
          err,
          "Could not verify account. Check the details and try again.",
        ),
      );
    }
  }

  async function handleSave() {
    setError("");
    try {
      await save.mutateAsync({
        bankCode,
        bankName: selectedBank?.name ?? "",
        accountNumber,
        accountName: resolvedName,
      });
      onSuccess();
    } catch (err) {
      setError(
        await getBankAccountErrorMessage(
          err,
          "Failed to save account. Please try again.",
        ),
      );
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Add bank account</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠ Withdrawals can only be sent to your own account. The name must
          match your verified identity.
        </Text>
      </View>

      {/* Bank picker */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Bank</Text>
        {banksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : banksFailed ? (
          <View style={styles.bankLoadError}>
            <Text style={styles.errorText}>
              {banksError instanceof HTTPError
                ? `Unable to load banks (server error ${banksError.response.status}).`
                : "Unable to load banks. Check your connection and try again."}
            </Text>
            <Pressable onPress={() => void refetchBanks()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.pickerWrap}>
            <ScrollView style={styles.bankList} nestedScrollEnabled>
              {banks.length === 0 ? (
                <Text style={styles.emptyBanks}>No banks are available.</Text>
              ) : (
                banks.map((b) => (
                  <Pressable
                    key={b.code}
                    style={[
                      styles.bankOption,
                      bankCode === b.code && styles.bankOptionSelected,
                    ]}
                    onPress={() => {
                      setBankCode(b.code);
                      setResolvedName("");
                      setError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.bankOptionText,
                        bankCode === b.code && styles.bankOptionTextSelected,
                      ]}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Account number */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Account number</Text>
        <TextInput
          style={styles.input}
          value={accountNumber}
          onChangeText={(v) => {
            setAccountNumber(v.replace(/\D/g, "").slice(0, 10));
            setResolvedName("");
            setError("");
          }}
          placeholder="10-digit account number"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          editable={!resolvedName}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {resolvedName ? (
        <View style={styles.resolvedBox}>
          <Text style={styles.resolvedLabel}>Account name</Text>
          <Text style={styles.resolvedName}>{resolvedName}</Text>
          <Text style={styles.resolvedSub}>
            {selectedBank?.name} · {accountNumber}
          </Text>
          <View style={styles.resolvedActions}>
            <Pressable
              style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save account</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.changeBtn}
              onPress={() => setResolvedName("")}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[
            styles.verifyBtn,
            (!canResolve || resolve.isPending) && styles.verifyBtnDisabled,
          ]}
          onPress={handleVerify}
          disabled={!canResolve || resolve.isPending}
        >
          {resolve.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify account</Text>
          )}
        </Pressable>
      )}

      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { gap: 14 },
    title: { fontSize: 15, fontWeight: "700", color: colors.text },
    warningBox: {
      backgroundColor: colors.warning + "10",
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.warningText + "90",
    },
    warningText: {
      fontSize: 12,
      color: colors.warningText + "90",
      lineHeight: 17,
    },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
    bankLoadError: { gap: 8 },
    retryText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    emptyBanks: { padding: 12, color: colors.textMuted, fontSize: 13 },
    pickerWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    bankList: { maxHeight: 160 },
    bankOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankOptionSelected: { backgroundColor: colors.primaryBg },
    bankOptionText: { fontSize: 14, color: colors.text },
    bankOptionTextSelected: { color: colors.primary, fontWeight: "700" },
    input: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    errorText: { fontSize: 13, color: colors.destructive },
    resolvedBox: {
      backgroundColor: colors.primaryBg,
      borderRadius: 12,
      padding: 14,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    resolvedLabel: {
      fontSize: 11,
      color: colors.primaryTextMid,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    resolvedName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primaryText,
    },
    resolvedSub: { fontSize: 12, color: colors.primaryTextMid },
    resolvedActions: { flexDirection: "row", gap: 10, marginTop: 8 },
    saveBtn: {
      flex: 1,
      height: 42,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    changeBtn: {
      paddingHorizontal: 14,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    changeBtnText: { fontSize: 14, color: colors.textMuted },
    verifyBtn: {
      height: 46,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    verifyBtnDisabled: { opacity: 0.5 },
    verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    cancelBtn: { alignItems: "center", paddingVertical: 8 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted },
  });
}
