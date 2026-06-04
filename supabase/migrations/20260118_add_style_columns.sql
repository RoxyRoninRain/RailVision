ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS mount_style text CHECK (mount_style IN ('shoerail', 'direct_mount'));
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS post_style text CHECK (post_style IN ('over_the_post', 'post_to_post'));
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS termination_style text CHECK (termination_style IN ('lambs_tongue', 'short_stop', 'volute', 'newel_post_termination'));
