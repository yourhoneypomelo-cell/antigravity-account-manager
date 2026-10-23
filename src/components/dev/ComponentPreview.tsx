import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SegmentedField } from "@/components/ui/segmented-field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  KeyRound,
  Trash2,
  ExternalLink,
  Shield,
  Moon,
  Sun,
  Plus,
} from "lucide-react";

export function ComponentPreview() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [segVal1, setSegVal1] = useState("未填写");
  const [segVal2, setSegVal2] = useState("开启");
  const [segVal3, setSegVal3] = useState("关闭");
  const [segVal4, setSegVal4] = useState("有");
  const [isCopied, setIsCopied] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className={`min-h-screen w-full p-8 transition-colors ${theme === "dark" ? "dark bg-background text-foreground" : "bg-background text-foreground"}`}>
      <div className="max-w-[960px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div>
            <h1 className="text-xl font-medium tracking-tight">Antigravity Account Manager ｜ 组件状态自检看板</h1>
            <p className="text-xs text-muted-foreground mt-1">
              用于验证 shadcn/ui 组件规范与 Impeccable 审查标准的一致性（本页面不进入用户主导航）
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-1.5">
            {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>切换至{theme === "light" ? "深色" : "浅色"}</span>
          </Button>
        </div>

        {/* 1. Buttons */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">1. 按钮变体与状态 (Button)</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default">主操作 (石墨色)</Button>
            <Button variant="default" disabled>主操作禁用</Button>
            <Button variant="outline">次要边框按钮</Button>
            <Button variant="outline" disabled>次要边框禁用</Button>
            <Button variant="ghost">幽灵按钮</Button>
            <Button variant="destructive">危险操作</Button>
            <Button variant="default" size="sm" className="gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>新增账号</span>
            </Button>
            <Button variant="outline" size="icon" title="查看">
              <Eye className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="outline" size="icon" title="更多">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </section>

        <Separator />

        {/* 2. Inputs & Textarea */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">2. 输入控件与标签 (Input, Label, Textarea)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="demo-email">Google 邮箱 (普通状态)</Label>
              <Input id="demo-email" defaultValue="alex.work.demo@gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-error">Google 邮箱 (错误状态)</Label>
              <Input id="demo-error" defaultValue="invalid-email-format" className="border-destructive focus-visible:ring-destructive" />
              <span className="text-[11px] text-destructive">请输入有效的邮箱地址</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-pw">密码输入框 (复合按键)</Label>
              <div className="relative flex items-center">
                <Input id="demo-pw" type="password" defaultValue="MySecretPass123" className="pr-16 font-mono-numbers" />
                <div className="absolute right-1 flex items-center gap-0.5">
                  <button type="button" className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded cursor-pointer">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setIsCopied(true)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded cursor-pointer">
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-remark">账号备注 (Textarea)</Label>
              <Textarea id="demo-remark" rows={2} defaultValue="主力研发工作号 - 进行中的新模型联调" />
            </div>
          </div>
        </section>

        <Separator />

        {/* 3. 3-State SegmentedField */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">3. 统一三态分段选择器 (SegmentedField)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">选中「未填写」状态：</span>
              <SegmentedField
                value={segVal1}
                onChange={setSegVal1}
                options={[
                  { value: "未填写", label: "未填写" },
                  { value: "开启", label: "开启" },
                  { value: "关闭", label: "关闭" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">选中「开启」状态：</span>
              <SegmentedField
                value={segVal2}
                onChange={setSegVal2}
                options={[
                  { value: "未填写", label: "未填写" },
                  { value: "开启", label: "开启" },
                  { value: "关闭", label: "关闭" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">选中「关闭」状态：</span>
              <SegmentedField
                value={segVal3}
                onChange={setSegVal3}
                options={[
                  { value: "未填写", label: "未填写" },
                  { value: "开启", label: "开启" },
                  { value: "关闭", label: "关闭" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">辅助邮箱三态 (未填写/无/有)：</span>
              <SegmentedField
                value={segVal4}
                onChange={setSegVal4}
                options={[
                  { value: "未填写", label: "未填写" },
                  { value: "无", label: "无" },
                  { value: "有", label: "有" },
                ]}
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* 4. Account List Items */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">4. 账号侧栏条目状态 (Account List Items)</h2>
          <div className="max-w-[272px] space-y-1 p-2 rounded-lg bg-sidebar border border-border-subtle">
            {/* Selected item */}
            <div className="h-[62px] px-3 rounded-[6px] bg-sidebar-accent flex flex-col justify-center cursor-pointer">
              <div className="text-[14px] leading-[20px] font-medium text-foreground truncate">
                alex.work.demo@gmail.com
              </div>
              <div className="text-[12px] leading-[18px] text-muted-foreground truncate mt-0.5">
                主力研发工作号 (当前选中)
              </div>
            </div>

            {/* Normal unselected item */}
            <div className="h-[62px] px-3 rounded-[6px] hover:bg-accent flex flex-col justify-center cursor-pointer transition-colors">
              <div className="text-[14px] leading-[20px] font-medium text-foreground truncate">
                bob.ai.research@gmail.com
              </div>
              <div className="text-[12px] leading-[18px] text-muted-foreground truncate mt-0.5">
                AI模型评测专用 (未选中)
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* 5. Menu & Dialog */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">5. 菜单与模态弹窗 (DropdownMenu & Dialog)</h2>
          <div className="flex items-center gap-4">
            {/* Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>打开操作菜单</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem className="gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>打开 Google 安全设置</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除账号</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>打开示例弹窗</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>管理通行密钥</DialogTitle>
                  <DialogDescription>
                    编辑保存在本地数据库中的通行密钥记录。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs">
                  <div>
                    <Label htmlFor="pk-name">显示名称</Label>
                    <Input id="pk-name" defaultValue="Google 密码管理工具" className="mt-1" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>取消</Button>
                  <Button variant="default" size="sm" onClick={() => setIsDialogOpen(false)}>保存记录</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <Separator />

        {/* 6. Backup Code Row Item */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight text-foreground">6. 备用验证码行 (Backup Code Item)</h2>
          <div className="max-w-[460px] border border-border-subtle rounded-md p-2 space-y-1">
            <div className="h-[42px] px-2 flex items-center justify-between border-b border-border-subtle hover:bg-accent/40 transition-colors text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 text-[12px] font-mono-numbers text-muted-foreground shrink-0">01.</span>
                <span className="font-mono-numbers text-[13px] tracking-normal text-foreground">•••• ••••</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" title="查看">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon-sm" title="复制">
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">
                  标记已用
                </Button>
              </div>
            </div>
            <div className="h-[42px] px-2 flex items-center justify-between hover:bg-accent/40 transition-colors text-xs opacity-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 text-[12px] font-mono-numbers text-muted-foreground shrink-0">02.</span>
                <span className="font-mono-numbers text-[13px] tracking-normal line-through text-muted-foreground">8492 1039</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">
                  已使用 (撤销)
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
